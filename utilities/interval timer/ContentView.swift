//
//  ContentView.swift
//  IntervalTimer
//

import SwiftUI
import AVFoundation

struct ContentView: View {
    @StateObject private var timerManager = TimerManager()
    
    var body: some View {
        Group {
            switch timerManager.state {
            case .setup:
                SetupView(timerManager: timerManager)
            case .countdown:
                CountdownView(timerManager: timerManager)
            case .running:
                TimerRunningView(timerManager: timerManager)
            case .completed:
                CompletedView(timerManager: timerManager)
            }
        }
        .preferredColorScheme(.light)
    }
}

// MARK: - Setup View
struct SetupView: View {
    @ObservedObject var timerManager: TimerManager
    @State private var workMinutes: Int = 0
    @State private var workSeconds: Int = 30
    @State private var restMinutes: Int = 0
    @State private var restSeconds: Int = 10
    @State private var intervals: Int = 8
    @State private var workPhrase: String = "Work"
    @State private var restPhrase: String = "Rest"
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                Text("Interval Timer")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .padding(.top, 20)
                
                // Work Time
                VStack(alignment: .leading, spacing: 8) {
                    Text("Work Time")
                        .font(.headline)
                    HStack(spacing: 10) {
                        VStack {
                            Text("Minutes")
                                .font(.caption)
                            Picker("Minutes", selection: $workMinutes) {
                                ForEach(0..<60) { Text("\($0)").tag($0) }
                            }
                            .pickerStyle(.wheel)
                            .frame(height: 100)
                        }
                        VStack {
                            Text("Seconds")
                                .font(.caption)
                            Picker("Seconds", selection: $workSeconds) {
                                ForEach(0..<60) { Text("\($0)").tag($0) }
                            }
                            .pickerStyle(.wheel)
                            .frame(height: 100)
                        }
                    }
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(10)
                
                // Rest Time
                VStack(alignment: .leading, spacing: 8) {
                    Text("Rest Time")
                        .font(.headline)
                    HStack(spacing: 10) {
                        VStack {
                            Text("Minutes")
                                .font(.caption)
                            Picker("Minutes", selection: $restMinutes) {
                                ForEach(0..<60) { Text("\($0)").tag($0) }
                            }
                            .pickerStyle(.wheel)
                            .frame(height: 100)
                        }
                        VStack {
                            Text("Seconds")
                                .font(.caption)
                            Picker("Seconds", selection: $restSeconds) {
                                ForEach(0..<60) { Text("\($0)").tag($0) }
                            }
                            .pickerStyle(.wheel)
                            .frame(height: 100)
                        }
                    }
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(10)
                
                // Intervals
                VStack(alignment: .leading, spacing: 8) {
                    Text("Number of Intervals")
                        .font(.headline)
                    Picker("Intervals", selection: $intervals) {
                        ForEach(1..<101) { Text("\($0)").tag($0) }
                    }
                    .pickerStyle(.wheel)
                    .frame(height: 100)
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(10)
                
                // Work Phrase
                VStack(alignment: .leading, spacing: 8) {
                    Text("Work Phrase")
                        .font(.headline)
                    TextField("Work", text: $workPhrase)
                        .textFieldStyle(.roundedBorder)
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(10)
                
                // Rest Phrase
                VStack(alignment: .leading, spacing: 8) {
                    Text("Rest Phrase")
                        .font(.headline)
                    TextField("Rest", text: $restPhrase)
                        .textFieldStyle(.roundedBorder)
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(10)
                
                Button(action: {
                    let workTotal = workMinutes * 60 + workSeconds
                    let restTotal = restMinutes * 60 + restSeconds
                    timerManager.startTimer(
                        workTime: workTotal,
                        restTime: restTotal,
                        intervals: intervals,
                        workPhrase: workPhrase.isEmpty ? "Work" : workPhrase,
                        restPhrase: restPhrase.isEmpty ? "Rest" : restPhrase
                    )
                }) {
                    Text("Start Timer")
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .cornerRadius(10)
                }
                .padding(.horizontal)
                .padding(.bottom, 30)
            }
            .padding()
        }
    }
}

// MARK: - Countdown View
struct CountdownView: View {
    @ObservedObject var timerManager: TimerManager
    
    var body: some View {
        ZStack {
            Color(.systemBackground)
                .ignoresSafeArea()
            
            VStack(spacing: 20) {
                Text("\(timerManager.countdown)")
                    .font(.system(size: 120, weight: .bold, design: .monospaced))
                    .foregroundColor(.primary)
                
                Text("Starting in...")
                    .font(.title2)
                    .foregroundColor(.secondary)
            }
        }
    }
}

// MARK: - Timer Running View
struct TimerRunningView: View {
    @ObservedObject var timerManager: TimerManager
    
    var body: some View {
        ZStack {
            (timerManager.isWorkPhase ? Color.green.opacity(0.1) : Color.orange.opacity(0.1))
                .ignoresSafeArea()
            
            VStack(spacing: 30) {
                // Phase Label
                Text(timerManager.currentPhaseText)
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundColor(timerManager.isWorkPhase ? .green : .orange)
                    .padding(.top, 60)
                
                Spacer()
                
                // Timer Display
                Text(timerManager.timeDisplay)
                    .font(.system(size: 100, weight: .bold, design: .monospaced))
                    .foregroundColor(.primary)
                    .padding()
                
                Spacer()
                
                // Interval Count
                Text("Interval \(timerManager.currentInterval) of \(timerManager.totalIntervals)")
                    .font(.title2)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                // Controls
                HStack(spacing: 20) {
                    Button(action: {
                        timerManager.togglePause()
                    }) {
                        Text(timerManager.isPaused ? "Resume" : "Pause")
                            .font(.title3)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.gray)
                            .cornerRadius(10)
                    }
                    
                    Button(action: {
                        timerManager.stopTimer()
                    }) {
                        Text("Stop")
                            .font(.title3)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.red)
                            .cornerRadius(10)
                    }
                }
                .padding(.horizontal, 40)
                .padding(.bottom, 40)
            }
        }
    }
}

// MARK: - Completed View
struct CompletedView: View {
    @ObservedObject var timerManager: TimerManager
    
    var body: some View {
        ZStack {
            Color(.systemBackground)
                .ignoresSafeArea()
            
            VStack(spacing: 30) {
                Text("✓ DONE")
                    .font(.system(size: 60, weight: .bold))
                    .foregroundColor(.green)
                
                Text("COMPLETE")
                    .font(.title)
                    .foregroundColor(.secondary)
                
                Text("Great work!")
                    .font(.title2)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                Button(action: {
                    timerManager.reset()
                }) {
                    Text("New Timer")
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .cornerRadius(10)
                }
                .padding(.horizontal, 40)
                .padding(.bottom, 40)
            }
            .padding()
        }
    }
}

#Preview {
    ContentView()
}
