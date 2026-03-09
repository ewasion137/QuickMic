using System;
using System.IO;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace QuickMic;

public partial class MainWindow : Window
{
    private AudioRecorder _recorder;

    public MainWindow()
    {
        InitializeComponent();
        _recorder = new AudioRecorder();

        // Когда NAudio дает новую громкость, перекидываем ее в JS
        _recorder.OnVolumeUpdate += volume =>
        {
            // Вызываем JS через Dispatcher, т.к. NAudio работает в другом потоке
            Dispatcher.InvokeAsync(() =>
            {
                // Отправляем JSON с громкостью
                webView.CoreWebView2.PostWebMessageAsJson($"{{\"type\":\"volume\", \"value\":{volume.ToString(System.Globalization.CultureInfo.InvariantCulture)}}}");
            });
        };

        InitializeWebView();
    }

    private async void InitializeWebView()
    {
        await webView.EnsureCoreWebView2Async(null);
        string htmlPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ui", "index.html");
        webView.CoreWebView2.Navigate(htmlPath);
        webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
    }

    private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string msg = e.TryGetWebMessageAsString();

        switch (msg)
        {
            case "start_rec":
                _recorder.StartRecording();
                break;
            case "pause_rec":
                _recorder.PauseRecording();
                break;
            case "resume_rec":
                _recorder.ResumeRecording();
                break;
            case "cancel_rec":
                _recorder.CancelRecording();
                break;
            case "finish_rec":
                _recorder.StopAndSave();
                // Отправляем команду в JS, что можно открывать редактор
                string json = $"{{\"type\":\"ready_to_cut\", \"file\":\"{_recorder.TempFilePath.Replace("\\", "\\\\")}\"}}";
                webView.CoreWebView2.PostWebMessageAsJson(json);
                break;
        }
    }
}