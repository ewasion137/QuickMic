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

        _recorder.OnVolumeUpdate += volume =>
        {
            Dispatcher.InvokeAsync(() =>
            {
                webView.CoreWebView2.PostWebMessageAsJson($"{{\"type\":\"volume\", \"value\":{volume.ToString(System.Globalization.CultureInfo.InvariantCulture)}}}");
            });
        };

        InitializeWebView();
    }

    private async void InitializeWebView()
    {
        await webView.EnsureCoreWebView2Async(null);

        // МАГИЯ: Мапим системную папку Temp на виртуальный хост, чтобы обойти CORS
        webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
            "temp.local",
            Path.GetTempPath(),
            CoreWebView2HostResourceAccessKind.Allow);

        string htmlPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ui", "index.html");
        webView.CoreWebView2.Navigate(htmlPath);
        webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
    }

    private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string msg = e.TryGetWebMessageAsString();

        switch (msg)
        {
            case "start_rec": _recorder.StartRecording(); break;
            case "pause_rec": _recorder.PauseRecording(); break;
            case "resume_rec": _recorder.ResumeRecording(); break;
            case "cancel_rec": _recorder.CancelRecording(); break;
            case "finish_rec":
                _recorder.StopAndSave();

                // Берем имя файла и создаем "фейковый" http-адрес для JS
                string fileName = Path.GetFileName(_recorder.TempFilePath);
                string virtualUrl = $"http://temp.local/{fileName}";

                string json = $"{{\"type\":\"ready_to_cut\", \"file\":\"{virtualUrl}\"}}";
                webView.CoreWebView2.PostWebMessageAsJson(json);
                break;
        }
    }
}