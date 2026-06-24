using System.Windows.Media;

namespace StopkekShell;

/// <summary>StopKEK brand palette, mirrored from the mobile app theme so the kiosk
/// reads as a continuation of the same product.</summary>
public static class Brand
{
    public static readonly Color Bg          = Hex("#0A0A0A");
    public static readonly Color BgElevated  = Hex("#141414");
    public static readonly Color BgCard      = Hex("#181818");
    public static readonly Color Border      = Hex("#2A2A2A");
    public static readonly Color Text        = Hex("#FFFFFF");
    public static readonly Color TextSecond  = Hex("#9E9E9E");
    public static readonly Color Accent      = Hex("#C41E24");
    public static readonly Color AccentBright = Hex("#E53935");
    public static readonly Color Success     = Hex("#2E7D32");
    public static readonly Color Warning     = Hex("#F9A825");
    public static readonly Color Danger      = Hex("#C62828");

    public static SolidColorBrush Brush(Color c) => new(c);

    public static Color Hex(string hex)
    {
        hex = hex.TrimStart('#');
        byte r = Convert.ToByte(hex.Substring(0, 2), 16);
        byte g = Convert.ToByte(hex.Substring(2, 2), 16);
        byte b = Convert.ToByte(hex.Substring(4, 2), 16);
        return Color.FromRgb(r, g, b);
    }
}
