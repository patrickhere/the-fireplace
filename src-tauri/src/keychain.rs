// ---------------------------------------------------------------------------
// Keychain Integration for Device Token Persistence
// ---------------------------------------------------------------------------
//
// Provides secure storage for device tokens using platform-native keychains:
// - macOS: Keychain Services
// - iOS: iOS Keychain
//
// Device tokens are stored with a unique key scoped to the gateway URL and
// device ID to support multiple device registrations across different gateways.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ---- Error Types ----------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum KeychainError {
    #[error("Keychain access denied: {0}")]
    AccessDenied(String),

    #[error("Token not found")]
    NotFound,

    #[error("Invalid data format: {0}")]
    InvalidData(String),

    #[error("Platform not supported")]
    UnsupportedPlatform,
}

impl From<KeychainError> for String {
    fn from(err: KeychainError) -> String {
        err.to_string()
    }
}

// ---- Device Token Structure -----------------------------------------------

/// Stored device token with metadata for validation and expiry tracking.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredDeviceToken {
    /// The device token value (opaque string from the server)
    pub token: String,

    /// Device ID this token is bound to
    pub device_id: String,

    /// Gateway URL this token was issued for
    pub gateway_url: String,

    /// Unix timestamp (ms) when the token was issued by the server
    pub issued_at_ms: i64,

    /// Unix timestamp (ms) when we stored the token locally
    pub stored_at_ms: i64,

    /// Role granted by the server (e.g. "operator")
    pub role: String,

    /// Scopes granted by the server
    pub scopes: Vec<String>,
}

// ---- Keychain Storage Key -------------------------------------------------

const KEYCHAIN_SERVICE_NAME: &str = "com.openclaw.the-fireplace";
const KEYCHAIN_ACCOUNT_PREFIX: &str = "device-token";

/// Build the keychain account name for a given device ID and gateway URL.
/// Format: device-token:{device_id}:{normalized_gateway_url}
fn build_keychain_key(device_id: &str, gateway_url: &str) -> String {
    // Normalize the gateway URL by removing protocol and trailing slashes
    let normalized = gateway_url
        .trim_start_matches("ws://")
        .trim_start_matches("wss://")
        .trim_end_matches('/');

    format!("{}:{}:{}", KEYCHAIN_ACCOUNT_PREFIX, device_id, normalized)
}

// ---- Platform-Specific Implementations ------------------------------------

#[cfg(any(target_os = "macos", target_os = "ios"))]
mod platform {
    use super::*;
    use security_framework::passwords::{get_generic_password, set_generic_password, delete_generic_password};

    pub fn store_token_impl(
        device_id: &str,
        gateway_url: &str,
        token_data: &StoredDeviceToken,
    ) -> Result<(), KeychainError> {
        let key = build_keychain_key(device_id, gateway_url);
        let value = serde_json::to_string(token_data)
            .map_err(|e| KeychainError::InvalidData(format!("Failed to serialize token: {}", e)))?;

        set_generic_password(KEYCHAIN_SERVICE_NAME, &key, value.as_bytes())
            .map_err(|e| KeychainError::AccessDenied(format!("Failed to store token: {}", e)))?;

        Ok(())
    }

    pub fn retrieve_token_impl(
        device_id: &str,
        gateway_url: &str,
    ) -> Result<StoredDeviceToken, KeychainError> {
        let key = build_keychain_key(device_id, gateway_url);

        let data = get_generic_password(KEYCHAIN_SERVICE_NAME, &key)
            .map_err(|_| KeychainError::NotFound)?;

        let token: StoredDeviceToken = serde_json::from_slice(&data)
            .map_err(|e| KeychainError::InvalidData(format!("Failed to parse token: {}", e)))?;

        Ok(token)
    }

    pub fn delete_token_impl(
        device_id: &str,
        gateway_url: &str,
    ) -> Result<(), KeychainError> {
        let key = build_keychain_key(device_id, gateway_url);

        delete_generic_password(KEYCHAIN_SERVICE_NAME, &key)
            .map_err(|_| KeychainError::NotFound)?;

        Ok(())
    }

    pub fn list_tokens_impl() -> Result<Vec<StoredDeviceToken>, KeychainError> {
        // Note: The security-framework crate doesn't provide a simple way to enumerate
        // all keychain items with a specific service name. For now, we'll return an
        // empty vec and rely on explicit device_id + gateway_url lookups.
        //
        // A full implementation would use SecItemCopyMatching with kSecMatchAll,
        // but that requires additional FFI work beyond the security-framework crate.
        Ok(vec![])
    }
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
mod platform {
    use super::*;

    pub fn store_token_impl(
        _device_id: &str,
        _gateway_url: &str,
        _token_data: &StoredDeviceToken,
    ) -> Result<(), KeychainError> {
        Err(KeychainError::UnsupportedPlatform)
    }

    pub fn retrieve_token_impl(
        _device_id: &str,
        _gateway_url: &str,
    ) -> Result<StoredDeviceToken, KeychainError> {
        Err(KeychainError::UnsupportedPlatform)
    }

    pub fn delete_token_impl(
        _device_id: &str,
        _gateway_url: &str,
    ) -> Result<(), KeychainError> {
        Err(KeychainError::UnsupportedPlatform)
    }

    pub fn list_tokens_impl() -> Result<Vec<StoredDeviceToken>, KeychainError> {
        Err(KeychainError::UnsupportedPlatform)
    }
}

// ---- Public API -----------------------------------------------------------

/// Store a device token in the platform keychain.
pub fn store_token(
    device_id: &str,
    gateway_url: &str,
    token_data: &StoredDeviceToken,
) -> Result<(), KeychainError> {
    platform::store_token_impl(device_id, gateway_url, token_data)
}

/// Retrieve a device token from the platform keychain.
pub fn retrieve_token(
    device_id: &str,
    gateway_url: &str,
) -> Result<StoredDeviceToken, KeychainError> {
    platform::retrieve_token_impl(device_id, gateway_url)
}

/// Delete a device token from the platform keychain.
pub fn delete_token(
    device_id: &str,
    gateway_url: &str,
) -> Result<(), KeychainError> {
    platform::delete_token_impl(device_id, gateway_url)
}

/// List all stored device tokens (limited support on some platforms).
pub fn list_tokens() -> Result<Vec<StoredDeviceToken>, KeychainError> {
    platform::list_tokens_impl()
}

// ---- Tauri Commands -------------------------------------------------------

#[tauri::command]
pub fn keychain_store_token(
    device_id: String,
    gateway_url: String,
    token: String,
    role: String,
    scopes: Vec<String>,
    issued_at_ms: i64,
) -> Result<(), String> {
    let token_data = StoredDeviceToken {
        token,
        device_id: device_id.clone(),
        gateway_url: gateway_url.clone(),
        issued_at_ms,
        stored_at_ms: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64,
        role,
        scopes,
    };

    store_token(&device_id, &gateway_url, &token_data)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn keychain_retrieve_token(
    device_id: String,
    gateway_url: String,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let token = retrieve_token(&device_id, &gateway_url)
        .map_err(|e| e.to_string())?;

    // Return as a HashMap that can be easily consumed by TypeScript
    let mut result = HashMap::new();
    result.insert("token".to_string(), serde_json::Value::String(token.token));
    result.insert("deviceId".to_string(), serde_json::Value::String(token.device_id));
    result.insert("gatewayUrl".to_string(), serde_json::Value::String(token.gateway_url));
    result.insert("issuedAtMs".to_string(), serde_json::Value::Number(token.issued_at_ms.into()));
    result.insert("storedAtMs".to_string(), serde_json::Value::Number(token.stored_at_ms.into()));
    result.insert("role".to_string(), serde_json::Value::String(token.role));
    result.insert("scopes".to_string(), serde_json::Value::Array(
        token.scopes.into_iter().map(serde_json::Value::String).collect()
    ));

    Ok(result)
}

#[tauri::command]
pub fn keychain_delete_token(
    device_id: String,
    gateway_url: String,
) -> Result<(), String> {
    delete_token(&device_id, &gateway_url)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn keychain_has_token(
    device_id: String,
    gateway_url: String,
) -> Result<bool, String> {
    match retrieve_token(&device_id, &gateway_url) {
        Ok(_) => Ok(true),
        Err(KeychainError::NotFound) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}
