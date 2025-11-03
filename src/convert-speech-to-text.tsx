import { Action, ActionPanel, Form, showToast, Toast, environment, Clipboard } from "@raycast/api";
import { useState, useRef } from "react";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { getOpenAIClient } from "./lib/openai";

export default function Command() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState<string>("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingProcessRef = useRef<any>(null);
  const outputFileRef = useRef<string>("");
  const recordingDirRef = useRef<string>("");

  const startRecording = async () => {
    try {
      // Create recordings directory in extension support path
      const recordingsDir = path.join(environment.supportPath, "recordings");
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }

      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timestamp = `${day}.${month}.${year}-${hours}.${minutes}.${seconds}`;
      
      // Create separate folder for this recording
      const recordingFolder = path.join(recordingsDir, timestamp);
      fs.mkdirSync(recordingFolder, { recursive: true });
      
      const outputPath = path.join(recordingFolder, "recording.wav");
      outputFileRef.current = outputPath;
      recordingDirRef.current = recordingFolder;
      
      // Use ffmpeg with macOS AVFoundation
      recordingProcessRef.current = spawn("/opt/homebrew/bin/ffmpeg", [
        "-f", "avfoundation",       // macOS audio input
        "-i", ":default",           // default microphone (system default audio input)
        "-fflags", "nobuffer",      // disable buffering for immediate capture
        "-flags", "low_delay",      // low latency mode
        "-ar", "16000",             // sample rate
        "-ac", "1",                 // mono
        "-y",                       // overwrite output file
        outputPath,
      ]);

      // Log errors for debugging
      recordingProcessRef.current.stderr?.on("data", (data: Buffer) => {
        console.log("ffmpeg stderr:", data.toString());
      });

      recordingProcessRef.current.on("error", (error: Error) => {
        showToast({
          style: Toast.Style.Failure,
          title: "Recording error",
          message: error.message,
        });
      });

      // Give ffmpeg time to initialize audio device
      await new Promise(resolve => setTimeout(resolve, 800));

      setIsRecording(true);

      await showToast({
        style: Toast.Style.Success,
        title: "Recording started",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to start recording",
      });
    }
  };

  const transcribeRecording = async () => {
    try {
      setIsTranscribing(true);
      setTranscription("");

      await showToast({
        style: Toast.Style.Animated,
        title: "Transcribing...",
      });

      const openai = getOpenAIClient();
      const audioFile = fs.createReadStream(outputFileRef.current);

      const response = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
      });

      const transcriptionText = response.text;
      setTranscription(transcriptionText);

      // Save transcription to file
      const transcriptionPath = path.join(recordingDirRef.current, "transcription.txt");
      fs.writeFileSync(transcriptionPath, transcriptionText, "utf-8");

      setIsTranscribing(false);

      await showToast({
        style: Toast.Style.Success,
        title: "Transcription complete",
      });
    } catch (error) {
      setIsTranscribing(false);
      await showToast({
        style: Toast.Style.Failure,
        title: "Transcription failed",
        message: error instanceof Error ? error.message : "Failed to transcribe",
      });
    }
  };

  const stopRecording = async () => {
    if (!recordingProcessRef.current) return;

    try {
      await showToast({
        style: Toast.Style.Animated,
        title: "Stopping recording...",
      });

      // Wait for ffmpeg to close properly
      await new Promise<void>((resolve) => {
        recordingProcessRef.current.once("close", () => {
          console.log("ffmpeg closed");
          resolve();
        });
        
        // Send q key to ffmpeg to stop gracefully
        recordingProcessRef.current.stdin?.write("q");
        recordingProcessRef.current.stdin?.end();
        
        // Fallback: kill after 3 seconds if not closed
        setTimeout(() => {
          if (recordingProcessRef.current) {
            recordingProcessRef.current.kill("SIGKILL");
            resolve();
          }
        }, 3000);
      });

      recordingProcessRef.current = null;
      setIsRecording(false);

      // Start transcription
      await transcribeRecording();
    } catch (error) {
      setIsRecording(false);
      recordingProcessRef.current = null;
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to stop recording",
      });
    }
  };

  const copyTranscription = async () => {
    await Clipboard.copy(transcription);
    await showToast({
      style: Toast.Style.Success,
      title: "Copied to clipboard",
    });
  };

  const startNewRecording = () => {
    setTranscription("");
  };

  return (
    <Form
      actions={
        <ActionPanel>
          {transcription ? (
            <>
              <Action title="Copy Transcription" onAction={copyTranscription} />
              <Action title="New Recording" onAction={startNewRecording} />
            </>
          ) : !isRecording && !isTranscribing ? (
            <Action title="Start Recording" onAction={startRecording} />
          ) : isRecording ? (
            <Action title="Stop Recording" onAction={stopRecording} />
          ) : null}
        </ActionPanel>
      }
    >
      <Form.Description
        title="Status"
        text={
          isRecording
            ? "🔴 Recording..."
            : isTranscribing
            ? "⏳ Transcribing..."
            : "⚪️ Ready to record"
        }
      />
      {transcription && (
        <Form.TextArea
          id="transcription"
          title="Transcription"
          value={transcription}
          onChange={() => {}}
        />
      )}
      {!transcription && (
        <Form.Description
          title="Instruction"
          text="Press Cmd+Enter to start/stop recording"
        />
      )}
    </Form>
  );
}

