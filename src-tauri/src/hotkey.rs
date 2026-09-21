use anyhow::{anyhow, Result};
use std::str::FromStr;
use tauri_plugin_global_shortcut::Shortcut;

pub fn parse(spec: &str) -> Result<Shortcut> {
    let normalized = normalize(spec)?;
    Shortcut::from_str(&normalized).map_err(|e| anyhow!(e.to_string()))
}

fn normalize(spec: &str) -> Result<String> {
    let tokens = spec
        .split('+')
        .map(|part| part.trim())
        .filter(|part| !part.is_empty())
        .map(normalize_token)
        .collect::<Vec<_>>();

    if tokens.is_empty() {
        return Err(anyhow!("empty shortcut"));
    }

    Ok(tokens.join("+"))
}

fn normalize_token(token: &str) -> String {
    match token.to_ascii_lowercase().as_str() {
        "ctrl" | "control" => "CONTROL".into(),
        "shift" => "SHIFT".into(),
        "alt" | "option" => "ALT".into(),
        "win" | "super" | "meta" | "cmd" | "command" => "SUPER".into(),
        "cmdorctrl" | "cmdorcontrol" | "commandorctrl" | "commandorcontrol" => {
            "COMMANDORCONTROL".into()
        }
        "space" => "SPACE".into(),
        "`" | "backquote" => "BACKQUOTE".into(),
        other => other.to_ascii_uppercase(),
    }
}
