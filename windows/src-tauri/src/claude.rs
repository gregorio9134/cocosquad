// Coco Client & Claude fallback — Connects desktop island to Coco Squad Server in Oracle Cloud.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::secrets;

const DEFAULT_COCO_SERVER: &str = "http://129.158.204.84";

pub const DEFAULT_MODEL: &str = "coco-squad";

#[derive(Default)]
pub struct Chat {
    messages: Mutex<Vec<Value>>,
}

impl Chat {
    pub fn reset(&self) {
        self.messages.lock().unwrap().clear();
    }

    fn push(&self, message: Value) {
        self.messages.lock().unwrap().push(message);
    }

    fn pop(&self) {
        self.messages.lock().unwrap().pop();
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ChatContext {
    File {
        name: String,
        path: String,
        #[serde(default)]
        base64: Option<String>,
    },
    Window { app_name: String, title: String, url: Option<String> },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ChatReply {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coco_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coco_nombre: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

/// One chat turn. Connects directly to the Oracle Cloud Coco Squad Server.
pub async fn send(
    chat: &Chat,
    _model: &str,
    query: String,
    context: Option<ChatContext>,
    coco_id: Option<String>,
) -> Result<ChatReply, String> {
    let server_base = secrets::get("coco-server-url")
        .unwrap_or_else(|| DEFAULT_COCO_SERVER.to_string());
    let endpoint = format!("{}/api/coco/chat", server_base.trim_end_matches('/'));

    let mut contexto = serde_json::Map::new();

    if let Some(ref ctx) = context {
        match ctx {
            ChatContext::File { name, path, base64 } => {
                contexto.insert("nombre".to_string(), json!(name));
                contexto.insert("path".to_string(), json!(path));
                contexto.insert("archivo".to_string(), json!(path));

                if let Some(ref b64) = base64 {
                    contexto.insert("archivo_base64".to_string(), json!(b64));
                } else if let Ok(bytes) = std::fs::read(path) {
                    if bytes.len() <= 25 * 1024 * 1024 {
                        let b64 = base64_for(&bytes);
                        contexto.insert("archivo_base64".to_string(), json!(b64));
                        contexto.insert("tamano_bytes".to_string(), json!(bytes.len()));
                    }
                }

                if let Ok(content) = std::fs::read_to_string(path) {
                    if content.len() < 50_000 {
                        contexto.insert("contenido_texto".to_string(), json!(content));
                    }
                }
            }
            ChatContext::Window { app_name, title, url } => {
                contexto.insert("app".to_string(), json!(app_name));
                contexto.insert("ventana".to_string(), json!(title));
                if let Some(u) = url {
                    contexto.insert("url".to_string(), json!(u));
                }
            }
        }
    }

    let mut body = json!({
        "message": query,
        "contexto": contexto
    });

    if let Some(cid) = coco_id {
        body["coco_id"] = json!(cid);
    }

    chat.push(json!({ "role": "user", "content": query }));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|e| format!("Error creando cliente HTTP: {e}"))?;

    let res = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await;

    match res {
        Ok(resp) => {
            let status = resp.status();
            if status.is_success() {
                let data: Value = resp.json().await.map_err(|e| format!("Error parseando JSON: {e}"))?;
                let text = data
                    .get("respuesta")
                    .and_then(Value::as_str)
                    .or_else(|| data.get("reply").and_then(Value::as_str))
                    .unwrap_or("Respuesta recibida del escuadrón.")
                    .to_string();

                let cid = data.get("coco_id").and_then(Value::as_str).map(String::from);
                let cnom = data.get("coco_nombre").and_then(Value::as_str).map(String::from);
                let col = data.get("color").and_then(Value::as_str).map(String::from);

                chat.push(json!({ "role": "assistant", "content": text.clone() }));

                Ok(ChatReply {
                    text,
                    coco_id: cid,
                    coco_nombre: cnom,
                    color: col,
                })
            } else {
                chat.pop();
                let err_text = resp.text().await.unwrap_or_default();
                Err(format!("Servidor Coco ({status}): {err_text}"))
            }
        }
        Err(e) => {
            chat.pop();
            Err(format!(
                "No se pudo conectar con el servidor Coco Squad ({server_base}): {e}"
            ))
        }
    }
}

/// Small standalone base64 encoder — also used for basic auth.
pub(crate) fn base64_for(bytes: &[u8]) -> String {
    base64(bytes)
}

fn base64(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b = [chunk[0], *chunk.get(1).unwrap_or(&0), *chunk.get(2).unwrap_or(&0)];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        out.push(TABLE[(n >> 18) as usize & 63] as char);
        out.push(TABLE[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 { TABLE[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if chunk.len() > 2 { TABLE[n as usize & 63] as char } else { '=' });
    }
    out
}
