import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useState, useRef } from "react";
import { spawn } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

export default function Command() {
  const [isRecording, setIsRecording] = useState(false);
  const recordingProcessRef = useRef<any>(null);
  const outputFileRef = useRef<string>("");

  const startRecording = async () => {
    try {
      const timestamp = new Date().getTime();
      const outputPath = path.join(os.homedir(), "Downloads", `recording-${timestamp}.mp3`);
      outputFileRef.current = outputPath;

      await showToast({
        style: Toast.Style.Animated,
        title: "Starting the recording...",
      });

      const wavPath = outputPath.replace(".mp3", ".wav");
      
      recordingProcessRef.current = spawn("/opt/homebrew/bin/sox", [
        "-d", // default audio device
        "-r", "16000", // sample rate
        "-c", "1", // mono
        "-b", "16", // 16-bit
        wavPath,
      ]);

      recordingProcessRef.current.on("error", (error: Error) => {
        showToast({
          style: Toast.Style.Failure,
          title: "Error occurred",
          message: error.message,
        });
      });

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

  const stopRecording = async () => {
    try {
      if (recordingProcessRef.current) {
        recordingProcessRef.current.kill("SIGINT");
        recordingProcessRef.current = null;
      }

      await showToast({
        style: Toast.Style.Animated,
        title: "Converting to MP3...",
      });

      const wavPath = outputFileRef.current.replace(".mp3", ".wav");
      
      await new Promise<void>((resolve, reject) => {
        const lameProcess = spawn("/opt/homebrew/bin/lame", [wavPath, outputFileRef.current]);
        
        lameProcess.on("close", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`lame exited with code ${code}`));
          }
        });
        
        lameProcess.on("error", (error) => {
          reject(error);
        });
      });
      
      fs.unlinkSync(wavPath);

      setIsRecording(false);

      await showToast({
        style: Toast.Style.Success,
        title: "Recording saved",
        message: outputFileRef.current,
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to stop recording",
      });
    }
  };

  return (
    <Form
      actions={
        <ActionPanel>
          {!isRecording ? (
            <Action title="Start recording" onAction={startRecording} />
          ) : (
            <Action title="Stop recording" onAction={stopRecording} />
          )}
        </ActionPanel>
      }
    >
      <Form.Description
        title="Status"
        text={isRecording ? "🔴 Recording..." : "⚪️ Ready to record"}
      />
      <Form.Description
        title="Instruction"
        text="Press Cmd+Enter to start/stop recording"
      />
    </Form>
  );
}

