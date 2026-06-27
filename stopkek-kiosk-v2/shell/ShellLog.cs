using System.IO;

namespace StopkekShell;

/// <summary>
/// Tiny dependency-free file logger for the shell. The shell runs as the limited player
/// in an interactive session, so it logs to %LOCALAPPDATA%\StopKEK\shell.log — a path the
/// player can always write and an admin can always read. The agent's own log lives in
/// %ProgramData% (written by SYSTEM); the player usually can't write there, hence a
/// separate file. Without this the shell was a black box: a login that "did nothing" left
/// no trace. Mirrors agent/Logging/FileLogger.cs::Write (rolling, never throws).
/// </summary>
public static class ShellLog
{
    private static readonly object Gate = new();
    private const long MaxBytes = 1 * 1024 * 1024;
    private static readonly string Path = BuildPath();

    private static string BuildPath()
    {
        try
        {
            var dir = System.IO.Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "StopKEK");
            Directory.CreateDirectory(dir);
            return System.IO.Path.Combine(dir, "shell.log");
        }
        catch { return string.Empty; }
    }

    public static void Write(string msg)
    {
        if (string.IsNullOrEmpty(Path)) return;
        lock (Gate)
        {
            try
            {
                if (File.Exists(Path) && new FileInfo(Path).Length > MaxBytes)
                {
                    var bak = Path + ".1";
                    if (File.Exists(bak)) File.Delete(bak);
                    File.Move(Path, bak);
                }
                File.AppendAllText(Path, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {msg}{Environment.NewLine}");
            }
            catch { /* logging must never throw */ }
        }
    }
}
