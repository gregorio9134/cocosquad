// Coco Squad chat client for the desktop app.

use std::sync::Mutex;

use serde_json::{json, Value};

use crate::coco_protocol::{build_chat_request, parse_chat_reply, ChatContext, ChatReply};

const DEFAULT_COCO_SERVER: &str = "http://150.136.59.173:8080";

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

/// One chat turn. Connects directly to the Oracle Cloud Coco Squad Server.
pub async fn send(
    chat: &Chat,
    _model: &str,
    query: String,
    context: Option<ChatContext>,
    coco_id: Option<String>,
) -> Result<ChatReply, String> {
    let endpoint = format!("{DEFAULT_COCO_SERVER}/api/chat");
    let body = build_chat_request(&query, context.as_ref(), coco_id.as_deref());

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|e| format!("Error creando cliente HTTP: {e}"))?;

    chat.push(json!({ "role": "user", "content": query }));

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
                let data: Value = match resp.json().await {
                    Ok(data) => data,
                    Err(e) => {
                        chat.pop();
                        return Err(format!("Error parseando JSON: {e}"));
                    }
                };
                let reply = match parse_chat_reply(data) {
                    Ok(reply) => reply,
                    Err(e) => {
                        chat.pop();
                        return Err(e);
                    }
                };

                chat.push(json!({ "role": "assistant", "content": reply.text.clone() }));

                Ok(reply)
            } else {
                chat.pop();
                let err_text = resp.text().await.map_err(|e| {
                    format!("Error leyendo el error del servidor Coco ({status}): {e}")
                })?;
                Err(format!("Servidor Coco ({status}): {err_text}"))
            }
        }
        Err(e) => {
            chat.pop();
            Err(format!(
                "No se pudo conectar con el servidor Coco Squad ({DEFAULT_COCO_SERVER}): {e}"
            ))
        }
    }
}
