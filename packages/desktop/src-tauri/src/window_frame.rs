use objc2_app_kit::{NSColor, NSWindow, NSWindowStyleMask};

const CORNER_RADIUS: f64 = 28.0;

// Called only from Tauri setup and window events on the AppKit main thread.
pub fn apply(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    let pointer = window.ns_window()?;
    // Tauri owns this NSWindow for the duration of the callback.
    let native = unsafe { &*pointer.cast::<NSWindow>() };
    let radius = if native.styleMask().contains(NSWindowStyleMask::FullScreen) {
        0.0
    } else {
        CORNER_RADIUS
    };
    native.setOpaque(false);
    native.setBackgroundColor(Some(&NSColor::clearColor()));
    native.setHasShadow(true);
    if let Some(content) = native.contentView() {
        // Clip the whole native frame, including the overlay title bar and controls.
        let frame = unsafe { content.superview() }.unwrap_or(content);
        frame.setWantsLayer(true);
        if let Some(layer) = frame.layer() {
            layer.setCornerRadius(radius);
            layer.setMasksToBounds(true);
        }
    }
    native.invalidateShadow();
    Ok(())
}
