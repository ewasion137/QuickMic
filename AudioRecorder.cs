using System;
using System.IO;
using NAudio.Wave;

namespace QuickMic;

public class AudioRecorder
{
    private WaveInEvent? _waveIn;
    private WaveFileWriter? _writer;
    private bool _isPaused = false;

    public string TempFilePath { get; } = Path.Combine(Path.GetTempPath(), "quickmic_temp.wav");
    public event Action<float>? OnVolumeUpdate;

    public void StartRecording()
    {
        if (_waveIn != null) return; // Уже пишем

        _isPaused = false;
        _waveIn = new WaveInEvent { WaveFormat = new WaveFormat(44100, 1) };
        _writer = new WaveFileWriter(TempFilePath, _waveIn.WaveFormat);

        _waveIn.DataAvailable += (s, e) =>
        {
            if (_isPaused) return; // Если пауза — просто игнорим данные с микрофона

            _writer!.Write(e.Buffer, 0, e.BytesRecorded);

            float max = 0;
            for (int i = 0; i < e.BytesRecorded; i += 2)
            {
                short sample = (short)((e.Buffer[i + 1] << 8) | e.Buffer[i]);
                float val = Math.Abs(sample / 32768f);
                if (val > max) max = val;
            }
            OnVolumeUpdate?.Invoke(max);
        };

        _waveIn.StartRecording();
    }

    public void PauseRecording() => _isPaused = true;
    public void ResumeRecording() => _isPaused = false;

    public void StopAndSave()
    {
        Cleanup();
    }

    public void CancelRecording()
    {
        Cleanup();
        if (File.Exists(TempFilePath))
        {
            File.Delete(TempFilePath); // Удаляем мусор, если отменили
        }
    }

    private void Cleanup()
    {
        _waveIn?.StopRecording();
        _waveIn?.Dispose();
        _writer?.Dispose();
        _waveIn = null;
        _writer = null;
    }
}