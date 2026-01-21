//
//  TimerManager.swift
//  IntervalTimer
//

import Foundation
import AVFoundation
import Combine

enum TimerState {
    case setup
    case countdown
    case running
    case completed
}

class TimerManager: ObservableObject {
    @Published var state: TimerState = .setup
    @Published var countdown: Int = 5
    @Published var timeRemaining: Int = 0
    @Published var currentInterval: Int = 1
    @Published var totalIntervals: Int = 8
    @Published var isWorkPhase: Bool = true
    @Published var isPaused: Bool = false
    @Published var currentPhaseText: String = "WORK"
    
    var timeDisplay: String {
        let minutes = timeRemaining / 60
        let seconds = timeRemaining % 60
        return "\(minutes):\(String(format: "%02d", seconds))"
    }
    
    private var workTime: Int = 0
    private var restTime: Int = 0
    private var workPhrase: String = "Work"
    private var restPhrase: String = "Rest"
    
    private var timer: Timer?
    private var countdownTimer: Timer?
    private var phaseStartTime: Date?
    private var pausedTime: TimeInterval = 0
    private var pauseStartTime: Date?
    
    private let synthesizer = AVSpeechSynthesizer()
    private var intervalAnnouncementStarted = false
    private var workCountdownStarted = false
    private var lastSpokenSecond: Int = -1
    
    func startTimer(workTime: Int, restTime: Int, intervals: Int, workPhrase: String, restPhrase: String) {
        self.workTime = workTime
        self.restTime = restTime
        self.totalIntervals = intervals
        self.workPhrase = workPhrase
        self.restPhrase = restPhrase
        self.currentInterval = 1
        self.isWorkPhase = true
        self.state = .countdown
        self.countdown = 5
        self.intervalAnnouncementStarted = false
        self.workCountdownStarted = false
        
        // Start countdown
        startCountdown()
    }
    
    private func startCountdown() {
        let countdownStartTime = Date()
        let countdownDuration = 5
        
        countdownTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            
            let elapsed = Int(Date().timeIntervalSince(countdownStartTime))
            let remaining = max(0, countdownDuration - elapsed)
            
            self.countdown = remaining
            
            // Speak countdown 3, 2, 1
            if remaining <= 3 && remaining > 0 && remaining != self.lastSpokenSecond {
                self.speak("\(remaining)")
                self.lastSpokenSecond = remaining
            }
            
            if remaining <= 0 {
                self.countdownTimer?.invalidate()
                self.countdownTimer = nil
                self.lastSpokenSecond = -1
                self.startActualTimer()
            }
        }
    }
    
    private func startActualTimer() {
        self.state = .running
        self.isWorkPhase = true
        self.timeRemaining = workTime
        self.currentPhaseText = workPhrase.uppercased()
        self.phaseStartTime = Date()
        self.pausedTime = 0
        self.intervalAnnouncementStarted = false
        self.workCountdownStarted = false
        
        speak("\(workPhrase) for \(formatTimeForSpeech(workTime))")
        
        startTimer()
    }
    
    private func startTimer() {
        timer?.invalidate()
        lastSpokenSecond = -1
        
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.tick()
        }
    }
    
    private func tick() {
        guard !isPaused else {
            if pauseStartTime == nil {
                pauseStartTime = Date()
            }
            return
        }
        
        // Resume from pause
        if let pauseStart = pauseStartTime {
            let pauseDuration = Date().timeIntervalSince(pauseStart)
            pausedTime += pauseDuration
            pauseStartTime = nil
        }
        
        guard let phaseStart = phaseStartTime else { return }
        
        let now = Date()
        let elapsed = now.timeIntervalSince(phaseStart) - pausedTime
        let previousRemaining = timeRemaining
        
        if isWorkPhase {
            timeRemaining = max(0, workTime - Int(elapsed))
        } else {
            timeRemaining = max(0, restTime - Int(elapsed))
        }
        
        // Handle announcements
        handleAnnouncements(previousRemaining: previousRemaining)
        
        if timeRemaining <= 0 {
            if isWorkPhase {
                // Switch to rest
                switchToRest()
            } else {
                // Switch to next work interval
                nextInterval()
            }
        }
    }
    
    private func handleAnnouncements(previousRemaining: Int) {
        // Work countdown (last 3 seconds)
        if isWorkPhase && timeRemaining <= 3 && timeRemaining > 0 {
            if !workCountdownStarted && previousRemaining > 3 {
                workCountdownStarted = true
            }
            if timeRemaining != lastSpokenSecond && timeRemaining > 0 {
                speak("\(timeRemaining)")
                lastSpokenSecond = timeRemaining
            }
        }
        
        // Rest countdown and interval announcement
        if !isWorkPhase && timeRemaining <= 5 && timeRemaining > 0 {
            // Interval announcement
            if currentInterval < totalIntervals {
                if !intervalAnnouncementStarted && previousRemaining > 5 {
                    intervalAnnouncementStarted = true
                    speak("Starting Interval \(currentInterval + 1) of \(totalIntervals) in")
                }
            }
            
            // Countdown (last 3 seconds)
            if timeRemaining <= 3 && timeRemaining != lastSpokenSecond && timeRemaining > 0 {
                speak("\(timeRemaining)")
                lastSpokenSecond = timeRemaining
            }
        }
    }
    
    private func switchToRest() {
        isWorkPhase = false
        phaseStartTime = Date()
        pausedTime = 0
        timeRemaining = restTime
        currentPhaseText = restPhrase.uppercased()
        intervalAnnouncementStarted = false
        workCountdownStarted = false
        lastSpokenSecond = -1
        
        speak("\(restPhrase) for \(formatTimeForSpeech(restTime))")
    }
    
    private func nextInterval() {
        currentInterval += 1
        intervalAnnouncementStarted = false
        workCountdownStarted = false
        
        if currentInterval > totalIntervals {
            completeTimer()
            return
        }
        
        isWorkPhase = true
        phaseStartTime = Date()
        pausedTime = 0
        timeRemaining = workTime
        currentPhaseText = workPhrase.uppercased()
        lastSpokenSecond = -1
        
        speak("\(workPhrase) for \(formatTimeForSpeech(workTime))")
    }
    
    private func completeTimer() {
        timer?.invalidate()
        timer = nil
        state = .completed
        speak("Workout complete! Great job!")
    }
    
    func togglePause() {
        isPaused.toggle()
    }
    
    func stopTimer() {
        timer?.invalidate()
        timer = nil
        countdownTimer?.invalidate()
        countdownTimer = nil
        synthesizer.stopSpeaking(at: .immediate)
        reset()
    }
    
    func reset() {
        timer?.invalidate()
        timer = nil
        countdownTimer?.invalidate()
        countdownTimer = nil
        state = .setup
        timeRemaining = 0
        currentInterval = 1
        isPaused = false
        phaseStartTime = nil
        pausedTime = 0
        pauseStartTime = nil
        intervalAnnouncementStarted = false
        workCountdownStarted = false
        lastSpokenSecond = -1
    }
    
    private func speak(_ text: String) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.rate = 0.5
        utterance.volume = 1.0
        
        // Try to use a more natural voice
        if let voice = AVSpeechSynthesisVoice.speechVoices().first(where: { $0.language.hasPrefix("en") }) {
            utterance.voice = voice
        }
        
        synthesizer.speak(utterance)
    }
    
    private func formatTimeForSpeech(_ seconds: Int) -> String {
        let minutes = seconds / 60
        let secs = seconds % 60
        
        if minutes > 0 && secs > 0 {
            return "\(minutes) \(minutes == 1 ? "minute" : "minutes") and \(secs) \(secs == 1 ? "second" : "seconds")"
        } else if minutes > 0 {
            return "\(minutes) \(minutes == 1 ? "minute" : "minutes")"
        } else {
            return "\(secs) \(secs == 1 ? "second" : "seconds")"
        }
    }
}
