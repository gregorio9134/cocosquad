// Coucou runs without a console window: Mochi is the whole UI.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    coucou_lib::app_log(">>> process main() started");
    if coucou_lib::wake_existing_instance() {
        coucou_lib::app_log(">>> wake_existing_instance returned true -> process exiting");
        return;
    }
    coucou_lib::app_log(">>> wake_existing_instance returned false -> calling coucou_lib::run()");
    coucou_lib::run();
    coucou_lib::app_log(">>> coucou_lib::run() returned -> process exiting");
}
