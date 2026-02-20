// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod keychain;
mod notifications;
#[cfg(target_os = "macos")]
mod tray;

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to The Fireplace.", name)
}

/// Returns the current platform as a string: "macos", "ios", or "unknown".
#[tauri::command]
fn get_platform() -> String {
    #[cfg(target_os = "macos")]
    {
        "macos".to_string()
    }
    #[cfg(target_os = "ios")]
    {
        "ios".to_string()
    }
    #[cfg(not(any(target_os = "macos", target_os = "ios")))]
    {
        "unknown".to_string()
    }
}

// ---- Ed25519 Device Identity (Rust-side, private key never leaves Rust) ----

/// Keychain service / account names for the Ed25519 device keypair.
/// Stored separately from device tokens so rotation is independent.
const ED25519_SERVICE: &str = "com.openclaw.the-fireplace";
const ED25519_ACCOUNT_PRIVKEY: &str = "ed25519-private-key";

/// Load or generate the Ed25519 keypair, persisting it in the platform Keychain.
/// Returns (private_key_bytes_32, public_key_bytes_32).
#[cfg(any(target_os = "macos", target_os = "ios"))]
fn load_or_create_ed25519_keypair() -> Result<([u8; 32], [u8; 32]), String> {
    const ERR_SEC_ITEM_NOT_FOUND: i32 = -25300;

    use security_framework::passwords::{get_generic_password, set_generic_password};

    // Try to load the existing private key
    match get_generic_password(ED25519_SERVICE, ED25519_ACCOUNT_PRIVKEY) {
        Ok(privkey_bytes) => {
            if privkey_bytes.len() != 32 {
                return Err(format!(
                    "Stored private key has unexpected length: {}",
                    privkey_bytes.len()
                ));
            }
            let mut privkey = [0u8; 32];
            privkey.copy_from_slice(&privkey_bytes);

            // Derive public key from private key to ensure consistency
            use ed25519_dalek::SigningKey;
            let signing_key = SigningKey::from_bytes(&privkey);
            let pubkey = signing_key.verifying_key().to_bytes();

            Ok((privkey, pubkey))
        }
        Err(err) => {
            if err.code() != ERR_SEC_ITEM_NOT_FOUND {
                return Err(format!(
                    "Failed to read Ed25519 private key from Keychain: {}",
                    err
                ));
            }

            // Generate a new keypair
            use ed25519_dalek::SigningKey;
            use rand::rngs::OsRng;

            let signing_key = SigningKey::generate(&mut OsRng);
            let privkey = signing_key.to_bytes();
            let pubkey = signing_key.verifying_key().to_bytes();

            // Persist private key in Keychain
            set_generic_password(ED25519_SERVICE, ED25519_ACCOUNT_PRIVKEY, &privkey)
                .map_err(|e| format!("Failed to store Ed25519 private key in Keychain: {}", e))?;

            Ok((privkey, pubkey))
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
fn load_or_create_ed25519_keypair() -> Result<([u8; 32], [u8; 32]), String> {
    Err("Ed25519 keychain is only supported on macOS and iOS".to_string())
}

/// Sign `payload` (UTF-8) with the device Ed25519 private key.
/// Returns a base64-url encoded signature (RFC 4648 §5, no padding).
/// The private key is NEVER returned to JavaScript — only the signature crosses the boundary.
#[tauri::command]
fn sign_payload(payload: String) -> Result<String, String> {
    use ed25519_dalek::{Signer, SigningKey};

    let (privkey, _) = load_or_create_ed25519_keypair()?;
    let signing_key = SigningKey::from_bytes(&privkey);
    let signature = signing_key.sign(payload.as_bytes());
    let sig_bytes = signature.to_bytes();

    // Base64-url encode without padding (matches OpenClaw's format)
    let b64 = base64::Engine::encode(
        &base64::engine::general_purpose::URL_SAFE_NO_PAD,
        sig_bytes,
    );
    Ok(b64)
}

/// Return the device's Ed25519 public key as a base64-url encoded string (no padding).
/// This is the public key in the format OpenClaw expects for device registration.
#[tauri::command]
fn get_device_public_key() -> Result<String, String> {
    let (_, pubkey) = load_or_create_ed25519_keypair()?;

    let b64 = base64::Engine::encode(
        &base64::engine::general_purpose::URL_SAFE_NO_PAD,
        pubkey,
    );
    Ok(b64)
}

/// Return the device ID: SHA-256 hash of the Ed25519 public key, hex-encoded.
/// Matches OpenClaw's device ID derivation exactly.
#[tauri::command]
fn get_device_id() -> Result<String, String> {
    use sha2::{Digest, Sha256};

    let (_, pubkey) = load_or_create_ed25519_keypair()?;

    let mut hasher = Sha256::new();
    hasher.update(&pubkey);
    let hash = hasher.finalize();

    Ok(hex::encode(hash))
}

// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_platform,
            notifications::send_notification,
            keychain::keychain_store_token,
            keychain::keychain_retrieve_token,
            keychain::keychain_delete_token,
            keychain::keychain_has_token,
            sign_payload,
            get_device_public_key,
            get_device_id,
            #[cfg(target_os = "macos")]
            tray::update_tray_status,
        ])
        .setup(|app| {
            // System tray — macOS only
            #[cfg(target_os = "macos")]
            {
                tray::setup_tray(app.handle())?;
            }

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
