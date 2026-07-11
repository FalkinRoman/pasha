using System.IO;
using System.Windows.Media;

namespace StopkekShell;

/// <summary>
/// Speaks a short pre-recorded Russian clip (e.g. "осталось пять минут") over whatever the
/// player is doing. Uses WPF <see cref="MediaPlayer"/> (PresentationCore, no NuGet) so it plays
/// bundled WAVs — the club PC needs no installed TTS voice. Sound is not bound to the window
/// z-order, so it reaches the player even in exclusive-fullscreen where a toast window can't.
/// </summary>
public sealed class VoiceAnnouncer
{
    // Clips live next to the exe in voice\<key>.wav (shipped via csproj Content).
    private readonly string _voiceDir =
        Path.Combine(AppContext.BaseDirectory, "voice");

    // Kept alive as a field: a garbage-collected MediaPlayer stops mid-clip.
    private readonly MediaPlayer _player = new();

    /// <summary>Play voice\<paramref name="key"/>.wav once. No-op if the clip is missing.</summary>
    public void Announce(string key)
    {
        var path = Path.Combine(_voiceDir, key + ".wav");
        if (!File.Exists(path))
        {
            ShellLog.Write($"voice: clip not found: {path}");
            return;
        }
        try
        {
            _player.Open(new Uri(path, UriKind.Absolute));
            _player.Position = TimeSpan.Zero;
            _player.Play();
            ShellLog.Write($"voice: playing {key}");
        }
        catch (Exception ex)
        {
            ShellLog.Write($"voice: play failed ({key}): {ex.Message}");
        }
    }
}
