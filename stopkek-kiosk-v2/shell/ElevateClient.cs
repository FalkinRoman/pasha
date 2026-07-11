using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using System.Windows;

namespace StopkekShell;

/// <summary>
/// "Запустить от stopKEK" mode: when the shell exe is started with --run, it does NOT put up
/// the overlay. It asks the SYSTEM agent to launch a program as the hidden admin (no password),
/// over the dedicated elevation pipe, and reports the outcome. Wired to a Desktop shortcut and
/// a SendTo entry so the player can right-click an installer/launcher and run it as admin.
/// </summary>
public static class ElevateClient
{
    private const string PipeName = "stopkek-kiosk-elevate";

    /// <summary>Runs the whole --run flow and returns a process exit code.</summary>
    public static int Run(string[] args)
    {
        string? path = FirstPath(args);
        if (path is null)
        {
            var dlg = new Microsoft.Win32.OpenFileDialog
            {
                Title = "Выберите программу для запуска от администратора",
                Filter = "Программы (*.exe;*.msi;*.bat;*.cmd)|*.exe;*.msi;*.bat;*.cmd|Все файлы (*.*)|*.*",
                CheckFileExists = true,
            };
            if (dlg.ShowDialog() != true) return 0; // cancelled
            path = dlg.FileName;
        }

        try
        {
            var (ok, error) = Send(path);
            if (!ok)
            {
                System.Windows.MessageBox.Show(error ?? "Не удалось запустить программу.", "stopKEK",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return 1;
            }
            return 0;
        }
        catch (Exception ex)
        {
            ShellLog.Write("elevate client error: " + ex);
            System.Windows.MessageBox.Show("Служба stopKEK недоступна. Попробуйте позже.", "stopKEK",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return 1;
        }
    }

    private static string? FirstPath(string[] args)
    {
        foreach (var a in args)
        {
            if (a.StartsWith("--", StringComparison.Ordinal)) continue;
            if (!string.IsNullOrWhiteSpace(a)) return a;
        }
        return null;
    }

    private static (bool ok, string? error) Send(string path)
    {
        using var pipe = new NamedPipeClientStream(".", PipeName, PipeDirection.InOut);
        pipe.Connect(4000);

        var writer = new StreamWriter(pipe, new UTF8Encoding(false)) { AutoFlush = true };
        var reader = new StreamReader(pipe, Encoding.UTF8);

        writer.WriteLine(JsonSerializer.Serialize(new { path }));

        var line = reader.ReadLine();
        if (string.IsNullOrWhiteSpace(line)) return (false, "Нет ответа от службы.");

        using var doc = JsonDocument.Parse(line);
        var root = doc.RootElement;
        bool ok = root.TryGetProperty("ok", out var okEl) && okEl.GetBoolean();
        string? error = root.TryGetProperty("error", out var errEl) ? errEl.GetString() : null;
        return (ok, error);
    }
}
