using Microsoft.Extensions.Logging;

namespace StopkekAgent.Logging;

/// <summary>
/// Tiny dependency-free file logger. The agent runs headless (SYSTEM scheduled task)
/// so a rolling log file is the only practical way to diagnose a PC in the field.
/// Writes to %ProgramData%\SysHost\logs\agent.log.
/// </summary>
public sealed class FileLoggerProvider : ILoggerProvider
{
    private readonly string _path;
    private readonly object _gate = new();
    private const long MaxBytes = 2 * 1024 * 1024;

    public FileLoggerProvider()
    {
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "SysHost", "logs");
        Directory.CreateDirectory(dir);
        _path = Path.Combine(dir, "agent.log");
    }

    public ILogger CreateLogger(string categoryName) => new FileLogger(this, categoryName);

    internal void Write(string line)
    {
        lock (_gate)
        {
            try
            {
                if (File.Exists(_path) && new FileInfo(_path).Length > MaxBytes)
                {
                    var bak = _path + ".1";
                    File.Delete(bak);
                    File.Move(_path, bak);
                }
                File.AppendAllText(_path, line + Environment.NewLine);
            }
            catch { /* logging must never throw */ }
        }
    }

    public void Dispose() { }

    private sealed class FileLogger(FileLoggerProvider provider, string category) : ILogger
    {
        private readonly string _category = category.Split('.').Last();

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Information;

        public void Log<TState>(LogLevel level, EventId id, TState state, Exception? ex,
            Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(level)) return;
            var msg = formatter(state, ex);
            var line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} [{level.ToString()[..4]}] {_category}: {msg}";
            if (ex is not null) line += " | " + ex;
            provider.Write(line);
        }
    }
}
