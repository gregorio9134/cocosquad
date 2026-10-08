use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::encoding::base64;

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ChatContext {
    File {
        name: String,
        path: String,
        #[serde(default)]
        base64: Option<String>,
    },
    Window {
        app_name: String,
        title: String,
        url: Option<String>,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
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

pub(crate) fn build_chat_request(
    query: &str,
    context: Option<&ChatContext>,
    coco_id: Option<&str>,
) -> Value {
    let mut contexto = serde_json::Map::new();

    if let Some(ctx) = context {
        match ctx {
            ChatContext::File {
                name,
                path,
                base64: provided_base64,
            } => {
                contexto.insert("nombre".to_string(), json!(name));
                contexto.insert("path".to_string(), json!(path));
                contexto.insert("archivo".to_string(), json!(path));

                if let Some(b64) = provided_base64 {
                    contexto.insert("archivo_base64".to_string(), json!(b64));
                } else if let Ok(bytes) = std::fs::read(path) {
                    if bytes.len() <= 25 * 1024 * 1024 {
                        contexto.insert("archivo_base64".to_string(), json!(base64(&bytes)));
                        contexto.insert("tamano_bytes".to_string(), json!(bytes.len()));
                    }
                }

                if let Ok(content) = std::fs::read_to_string(path) {
                    if content.len() < 50_000 {
                        contexto.insert("contenido_texto".to_string(), json!(content));
                    }
                }
            }
            ChatContext::Window {
                app_name,
                title,
                url,
            } => {
                contexto.insert("app".to_string(), json!(app_name));
                contexto.insert("ventana".to_string(), json!(title));
                if let Some(url) = url {
                    contexto.insert("url".to_string(), json!(url));
                }
            }
        }
    }

    let mut body = json!({
        "message": query,
        "contexto": contexto
    });

    if let Some(coco_id) = coco_id {
        body["coco_id"] = json!(coco_id);
    }

    body
}

pub(crate) fn parse_chat_reply(data: Value) -> Result<ChatReply, String> {
    let text = data
        .get("respuesta")
        .and_then(Value::as_str)
        .or_else(|| data.get("reply").and_then(Value::as_str))
        .filter(|text| !text.trim().is_empty())
        .ok_or_else(|| "El servidor Coco devolvió una respuesta sin texto.".to_string())?
        .to_string();

    Ok(ChatReply {
        text,
        coco_id: data
            .get("coco_id")
            .and_then(Value::as_str)
            .map(String::from),
        coco_nombre: data
            .get("coco_nombre")
            .and_then(Value::as_str)
            .map(String::from),
        color: data.get("color").and_then(Value::as_str).map(String::from),
    })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{build_chat_request, parse_chat_reply, ChatContext};

    #[test]
    fn builds_request_with_selected_coco_and_window_context() {
        let context = ChatContext::Window {
            app_name: "Safari".into(),
            title: "Coco Squad".into(),
            url: Some("https://example.com".into()),
        };

        assert_eq!(
            build_chat_request("hola", Some(&context), Some("coco_verde")),
            json!({
                "message": "hola",
                "coco_id": "coco_verde",
                "contexto": {
                    "app": "Safari",
                    "ventana": "Coco Squad",
                    "url": "https://example.com"
                }
            })
        );
    }

    #[test]
    fn builds_request_without_optional_context() {
        assert_eq!(
            build_chat_request("hola", None, None),
            json!({ "message": "hola", "contexto": {} })
        );
    }

    #[test]
    fn includes_file_metadata_and_provided_base64() {
        let context = ChatContext::File {
            name: "notas.txt".into(),
            path: "/tmp/notas.txt".into(),
            base64: Some("bm90YXM=".into()),
        };

        assert_eq!(
            build_chat_request("analiza", Some(&context), Some("coco_blanco")),
            json!({
                "message": "analiza",
                "coco_id": "coco_blanco",
                "contexto": {
                    "nombre": "notas.txt",
                    "path": "/tmp/notas.txt",
                    "archivo": "/tmp/notas.txt",
                    "archivo_base64": "bm90YXM="
                }
            })
        );
    }

    #[test]
    fn deserializes_frontend_window_context_shape() {
        let context: ChatContext = serde_json::from_value(json!({
            "kind": "window",
            "appName": "Safari",
            "title": "Coco Squad",
            "url": "https://example.com"
        }))
        .expect("frontend window context should deserialize");

        assert!(matches!(
            context,
            ChatContext::Window { app_name, title, url }
                if app_name == "Safari"
                    && title == "Coco Squad"
                    && url.as_deref() == Some("https://example.com")
        ));
    }

    #[test]
    fn parses_server_reply_fields() {
        assert_eq!(
            parse_chat_reply(json!({
                "respuesta": "Listo",
                "coco_id": "coco_rojo",
                "coco_nombre": "Coco Rojo",
                "color": "#ef4444"
            }))
            .unwrap(),
            super::ChatReply {
                text: "Listo".into(),
                coco_id: Some("coco_rojo".into()),
                coco_nombre: Some("Coco Rojo".into()),
                color: Some("#ef4444".into()),
            }
        );
    }

    #[test]
    fn parses_legacy_reply_field_without_optional_metadata() {
        assert_eq!(
            parse_chat_reply(json!({ "reply": "Hola" })).unwrap(),
            super::ChatReply {
                text: "Hola".into(),
                coco_id: None,
                coco_nombre: None,
                color: None,
            }
        );
    }

    #[test]
    fn rejects_missing_reply_text() {
        assert!(parse_chat_reply(json!({})).is_err());
    }
}
