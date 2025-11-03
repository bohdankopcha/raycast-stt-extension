import { List, ActionPanel, Action, Detail, environment, showToast, Toast, Alert, confirmAlert, Form, useNavigation } from "@raycast/api";
import { useState, useEffect } from "react";
import * as fs from "fs";
import * as path from "path";

interface Metadata {
  title: string;
  timestamp: string;
  createdAt: string;
}

interface Recording {
  folderName: string;
  title: string;
  date: Date;
  audioPath: string;
  transcriptionPath: string;
  metadataPath: string;
  hasTranscription: boolean;
  hasMetadata: boolean;
}

export default function Command() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRecordings();
  }, []);

  const reloadRecordings = () => {
    loadRecordings();
  };

  const loadRecordings = () => {
    try {
      const recordingsDir = path.join(environment.supportPath, "recordings");
      
      if (!fs.existsSync(recordingsDir)) {
        setRecordings([]);
        setIsLoading(false);
        return;
      }

      const folders = fs.readdirSync(recordingsDir);
      const recordingsList: Recording[] = [];

      for (const folder of folders) {
        const folderPath = path.join(recordingsDir, folder);
        const stat = fs.statSync(folderPath);

        if (stat.isDirectory()) {
          const audioPath = path.join(folderPath, "recording.wav");
          const transcriptionPath = path.join(folderPath, "transcription.txt");
          const metadataPath = path.join(folderPath, "metadata.json");
          
          if (fs.existsSync(audioPath)) {
            let title = folder;
            let hasMetadata = false;

            // Load title from metadata if exists
            if (fs.existsSync(metadataPath)) {
              try {
                const metadataContent = fs.readFileSync(metadataPath, "utf-8");
                const metadata: Metadata = JSON.parse(metadataContent);
                title = metadata.title;
                hasMetadata = true;
              } catch (error) {
                console.error("Failed to parse metadata:", error);
              }
            }

            recordingsList.push({
              folderName: folder,
              title,
              date: stat.mtime,
              audioPath,
              transcriptionPath,
              metadataPath,
              hasTranscription: fs.existsSync(transcriptionPath),
              hasMetadata,
            });
          }
        }
      }

      // Sort by date, newest first
      recordingsList.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      setRecordings(recordingsList);
      setIsLoading(false);
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to load recordings",
        message: error instanceof Error ? error.message : "Unknown error",
      });
      setIsLoading(false);
    }
  };

  const deleteRecording = async (recording: Recording) => {
    const confirmed = await confirmAlert({
      title: "Delete Recording",
      message: `Are you sure you want to delete "${recording.title}"?`,
      primaryAction: {
        title: "Delete",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (confirmed) {
      try {
        const folderPath = path.dirname(recording.audioPath);
        fs.rmSync(folderPath, { recursive: true, force: true });
        
        await showToast({
          style: Toast.Style.Success,
          title: "Recording deleted",
        });
        
        loadRecordings();
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to delete",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  };

  const deleteAllRecordings = async () => {
    const confirmed = await confirmAlert({
      title: "Delete All Recordings",
      message: `Are you sure you want to delete ALL ${recordings.length} recordings? This action cannot be undone.`,
      primaryAction: {
        title: "Delete All",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (confirmed) {
      try {
        const recordingsDir = path.join(environment.supportPath, "recordings");
        fs.rmSync(recordingsDir, { recursive: true, force: true });
        fs.mkdirSync(recordingsDir, { recursive: true });
        
        await showToast({
          style: Toast.Style.Success,
          title: "All recordings deleted",
        });
        
        loadRecordings();
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to delete all",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  };

  return (
    <List isLoading={isLoading}>
      {recordings.length === 0 ? (
        <List.EmptyView
          title="No recordings yet"
          description="Start recording to see your history here"
        />
      ) : (
        recordings.map((recording) => (
          <List.Item
            key={recording.folderName}
            title={recording.title}
            subtitle={recording.hasTranscription ? "✓ Transcribed" : "⏳ No transcription"}
            accessories={[
              { text: recording.folderName },
              { date: recording.date },
            ]}
            actions={
              <ActionPanel>
                <Action.Push
                  title="View Details"
                  target={<RecordingDetail recording={recording} onUpdate={reloadRecordings} />}
                />
                <Action.Push
                  title="Rename"
                  target={<RenameRecordingForm recording={recording} onUpdate={reloadRecordings} />}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                />
                <Action
                  title="Delete"
                  onAction={() => deleteRecording(recording)}
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                />
                {recordings.length > 1 && (
                  <Action
                    title="Delete All Recordings"
                    onAction={deleteAllRecordings}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "backspace" }}
                  />
                )}
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}

function RenameRecordingForm({ recording, onUpdate }: { recording: Recording; onUpdate: () => void }) {
  const { pop } = useNavigation();
  const [title, setTitle] = useState(recording.title);

  const handleSubmit = async () => {
    try {
      const metadata: Metadata = {
        title,
        timestamp: recording.folderName,
        createdAt: recording.hasMetadata 
          ? JSON.parse(fs.readFileSync(recording.metadataPath, "utf-8")).createdAt 
          : new Date().toISOString(),
      };

      fs.writeFileSync(recording.metadataPath, JSON.stringify(metadata, null, 2), "utf-8");

      await showToast({
        style: Toast.Style.Success,
        title: "Recording renamed",
      });

      onUpdate();
      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to rename",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Rename" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="Title"
        placeholder="Enter new title"
        value={title}
        onChange={setTitle}
      />
    </Form>
  );
}

function RecordingDetail({ recording, onUpdate }: { recording: Recording; onUpdate: () => void }) {
  const { pop } = useNavigation();
  const [transcription, setTranscription] = useState<string>("");

  useEffect(() => {
    if (recording.hasTranscription) {
      const text = fs.readFileSync(recording.transcriptionPath, "utf-8");
      setTranscription(text);
    }
  }, [recording]);

  const deleteRecording = async () => {
    const confirmed = await confirmAlert({
      title: "Delete Recording",
      message: `Are you sure you want to delete "${recording.title}"?`,
      primaryAction: {
        title: "Delete",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (confirmed) {
      try {
        const folderPath = path.dirname(recording.audioPath);
        fs.rmSync(folderPath, { recursive: true, force: true });
        
        await showToast({
          style: Toast.Style.Success,
          title: "Recording deleted",
        });
        
        onUpdate();
        pop();
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to delete",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  };

  const markdown = `
# ${recording.title}

${recording.hasTranscription ? `## Transcription\n\n\`\`\`${transcription}\`\`\`` : "## No transcription available"}

---

**Date:** ${recording.folderName}  
**Audio file:** \`${recording.audioPath}\`
${recording.hasTranscription ? `\n**Transcription file:** \`${recording.transcriptionPath}\`` : ""}
  `;

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          {recording.hasTranscription && (
            <Action.CopyToClipboard
              title="Copy Transcription"
              content={transcription}
            />
          )}
          <Action.ShowInFinder path={path.dirname(recording.audioPath)} />
          <Action.Push
            title="Rename"
            target={<RenameRecordingForm recording={recording} onUpdate={onUpdate} />}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
          />
          <Action
            title="Delete"
            onAction={deleteRecording}
            style={Action.Style.Destructive}
            shortcut={{ modifiers: ["cmd"], key: "backspace" }}
          />
        </ActionPanel>
      }
    />
  );
}

