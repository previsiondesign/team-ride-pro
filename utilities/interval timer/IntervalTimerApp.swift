//
//  IntervalTimerApp.swift
//  IntervalTimer
//
//  Native iOS app for MTB interval training
//

import SwiftUI
import AVFoundation

@main
struct IntervalTimerApp: App {
    init() {
        // Configure audio session for background playback
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Failed to set up audio session: \(error)")
        }
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
