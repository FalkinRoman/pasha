namespace StopkekShell.Ipc;

/// <summary>Where the shell gets its KioskView from: the real agent pipe, or a mock.</summary>
public interface IViewSource : IDisposable
{
    event Action<KioskView>? ViewUpdated;
    void Start();
    void SendCommand(string cmd);
    /// <summary>Send the admin panic-exit PIN to the agent for validation.</summary>
    void SendAdminExit(string pin);
}
