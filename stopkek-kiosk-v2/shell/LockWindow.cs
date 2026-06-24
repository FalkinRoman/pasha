using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Documents;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Forms = System.Windows.Forms;

namespace StopkekShell;

/// <summary>
/// Fullscreen lock screen for one monitor. Black StopKEK background, the rotating QR
/// from the server, and the instruction to scan it in the app. Borderless, topmost,
/// not in taskbar, cannot be closed by the user (WM_CLOSE swallowed).
/// </summary>
public sealed class LockWindow : Window
{
    private readonly bool _isPrimary;
    private readonly bool _preview;
    private readonly Forms.Screen _screen;
    private readonly Action<string>? _onAdminPin;

    private Image? _qrImage;
    private TextBlock? _qrFallback;
    private Border? _qrCard;
    private TextBlock? _seatText;
    private TextBlock? _statusText;

    // Admin panic-exit affordance
    private Button? _adminBtn;
    private Border? _keypad;
    private TextBlock? _pinDisplay;
    private string _pin = "";

    public LockWindow(Forms.Screen screen, bool isPrimary, bool preview = false, Action<string>? onAdminPin = null)
    {
        _screen = screen;
        _isPrimary = isPrimary;
        _preview = preview;
        _onAdminPin = onAdminPin;

        Background = Brand.Brush(Brand.Bg);
        Title = "stopKEK";

        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        ShowInTaskbar = false;
        if (preview)
        {
            // Real fullscreen positioning, but Esc-closable and not topmost — safe to view.
            KeyDown += (_, e) => { if (e.Key == System.Windows.Input.Key.Escape) Application.Current.Shutdown(); };
        }
        else
        {
            Topmost = true;
        }

        Content = BuildUi();
        SourceInitialized += OnSourceInitialized;
    }

    private UIElement BuildUi()
    {
        var root = new Grid();

        var stack = new StackPanel
        {
            HorizontalAlignment = System.Windows.HorizontalAlignment.Center,
            VerticalAlignment = System.Windows.VerticalAlignment.Center,
        };

        // Logo: stop + КЕК
        var logo = new TextBlock
        {
            FontSize = _isPrimary ? 88 : 64,
            FontWeight = FontWeights.Black,
            HorizontalAlignment = System.Windows.HorizontalAlignment.Center,
            Margin = new Thickness(0, 0, 0, 8),
        };
        logo.Inlines.Add(new Run("stop") { Foreground = Brand.Brush(Brand.Text) });
        logo.Inlines.Add(new Run("КЕК") { Foreground = Brand.Brush(Brand.Accent) });
        stack.Children.Add(logo);

        stack.Children.Add(new TextBlock
        {
            Text = "Компьютер заблокирован",
            FontSize = _isPrimary ? 22 : 18,
            Foreground = Brand.Brush(Brand.TextSecond),
            HorizontalAlignment = System.Windows.HorizontalAlignment.Center,
            Margin = new Thickness(0, 0, 0, _isPrimary ? 36 : 20),
        });

        if (_isPrimary)
        {
            // QR card
            _qrImage = new Image { Width = 260, Height = 260, Stretch = Stretch.Uniform };
            _qrFallback = new TextBlock
            {
                Text = "QR появится здесь",
                Foreground = Brand.Brush(Brand.TextSecond),
                HorizontalAlignment = System.Windows.HorizontalAlignment.Center,
                VerticalAlignment = System.Windows.VerticalAlignment.Center,
                TextWrapping = TextWrapping.Wrap,
                TextAlignment = TextAlignment.Center,
                Width = 240,
            };
            var qrHost = new Grid { Width = 260, Height = 260 };
            qrHost.Children.Add(_qrFallback);
            qrHost.Children.Add(_qrImage);

            _qrCard = new Border
            {
                Background = Brand.Brush(Colors.White),
                CornerRadius = new CornerRadius(20),
                Padding = new Thickness(18),
                HorizontalAlignment = System.Windows.HorizontalAlignment.Center,
                Child = qrHost,
            };
            stack.Children.Add(_qrCard);

            stack.Children.Add(new TextBlock
            {
                Text = "Откройте приложение stopКЕК  →  Сеанс  →  «Сканировать QR на мониторе»",
                FontSize = 18,
                Foreground = Brand.Brush(Brand.Text),
                HorizontalAlignment = System.Windows.HorizontalAlignment.Center,
                Margin = new Thickness(0, 28, 0, 0),
                TextAlignment = TextAlignment.Center,
                TextWrapping = TextWrapping.Wrap,
                MaxWidth = 560,
            });
        }

        // Seat badge
        _seatText = new TextBlock
        {
            Text = "Место —",
            FontSize = _isPrimary ? 20 : 16,
            FontWeight = FontWeights.SemiBold,
            Foreground = Brand.Brush(Brand.AccentBright),
            HorizontalAlignment = System.Windows.HorizontalAlignment.Center,
            Margin = new Thickness(0, _isPrimary ? 24 : 14, 0, 0),
        };
        stack.Children.Add(_seatText);

        root.Children.Add(stack);

        // Status line (bottom)
        _statusText = new TextBlock
        {
            Text = "",
            FontSize = 13,
            Foreground = Brand.Brush(Brand.TextSecond),
            HorizontalAlignment = System.Windows.HorizontalAlignment.Center,
            VerticalAlignment = System.Windows.VerticalAlignment.Bottom,
            Margin = new Thickness(0, 0, 0, 18),
        };
        root.Children.Add(_statusText);

        BuildAdminExit(root);

        return root;
    }

    // --- admin panic-exit: faint corner button -> on-screen PIN keypad --------
    private void BuildAdminExit(Grid root)
    {
        // Faint, easy-to-miss close button in the top-right corner.
        _adminBtn = new Button
        {
            Content = "✕",
            FontSize = 18,
            Width = 40,
            Height = 40,
            Foreground = Brand.Brush(Brand.TextSecond),
            Background = Brushes.Transparent,
            BorderThickness = new Thickness(0),
            Opacity = 0.18,
            Cursor = System.Windows.Input.Cursors.Hand,
            HorizontalAlignment = System.Windows.HorizontalAlignment.Right,
            VerticalAlignment = System.Windows.VerticalAlignment.Top,
            Margin = new Thickness(0, 10, 14, 0),
            Visibility = Visibility.Collapsed,
        };
        _adminBtn.Click += (_, _) => ShowKeypad(true);
        root.Children.Add(_adminBtn);

        // Keypad overlay (hidden until the button is pressed).
        _pinDisplay = new TextBlock
        {
            Text = "",
            FontSize = 28,
            MinHeight = 40,
            FontWeight = FontWeights.Bold,
            Foreground = Brand.Brush(Brand.Text),
            HorizontalAlignment = System.Windows.HorizontalAlignment.Center,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 14),
        };

        var grid = new UniformGrid { Columns = 3, Rows = 4, Width = 240, Height = 300 };
        foreach (var d in new[] { "1", "2", "3", "4", "5", "6", "7", "8", "9" })
            grid.Children.Add(PadButton(d, () => AppendDigit(d)));
        grid.Children.Add(PadButton("⌫", Backspace));
        grid.Children.Add(PadButton("0", () => AppendDigit("0")));
        grid.Children.Add(PadButton("OK", Submit));

        var inner = new StackPanel { HorizontalAlignment = System.Windows.HorizontalAlignment.Center };
        inner.Children.Add(new TextBlock
        {
            Text = "Служебный выход",
            FontSize = 16,
            Foreground = Brand.Brush(Brand.TextSecond),
            HorizontalAlignment = System.Windows.HorizontalAlignment.Center,
            Margin = new Thickness(0, 0, 0, 10),
        });
        inner.Children.Add(_pinDisplay);
        inner.Children.Add(grid);
        inner.Children.Add(PadButton("Отмена", () => ShowKeypad(false)));

        _keypad = new Border
        {
            Background = Brand.Brush(Brand.Bg),
            BorderBrush = Brand.Brush(Brand.TextSecond),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(16),
            Padding = new Thickness(24),
            HorizontalAlignment = System.Windows.HorizontalAlignment.Center,
            VerticalAlignment = System.Windows.VerticalAlignment.Center,
            Visibility = Visibility.Collapsed,
            Child = inner,
        };
        root.Children.Add(_keypad);
    }

    private Button PadButton(string text, Action onClick)
    {
        var b = new Button
        {
            Content = text,
            FontSize = 20,
            Margin = new Thickness(6),
            Foreground = Brand.Brush(Brand.Text),
            Background = Brand.Brush(Brand.Accent),
            BorderThickness = new Thickness(0),
            Cursor = System.Windows.Input.Cursors.Hand,
        };
        b.Click += (_, _) => onClick();
        return b;
    }

    private void ShowKeypad(bool show)
    {
        _pin = "";
        if (_pinDisplay is not null) _pinDisplay.Text = "";
        if (_keypad is not null) _keypad.Visibility = show ? Visibility.Visible : Visibility.Collapsed;
    }

    private void AppendDigit(string d)
    {
        if (_pin.Length >= 12) return;
        _pin += d;
        if (_pinDisplay is not null) _pinDisplay.Text = new string('●', _pin.Length);
    }

    private void Backspace()
    {
        if (_pin.Length == 0) return;
        _pin = _pin[..^1];
        if (_pinDisplay is not null) _pinDisplay.Text = new string('●', _pin.Length);
    }

    private void Submit()
    {
        var pin = _pin;
        ShowKeypad(false);
        if (!string.IsNullOrEmpty(pin)) _onAdminPin?.Invoke(pin);
        // On success the agent flips to Maintenance and this window is hidden by the
        // controller; on a wrong PIN nothing changes and the operator can try again.
    }

    public void UpdateView(KioskView v)
    {
        if (_adminBtn is not null)
            _adminBtn.Visibility = v.AdminExitEnabled ? Visibility.Visible : Visibility.Collapsed;

        if (_seatText is not null) _seatText.Text = $"Место #{v.SeatNumber}";

        if (_statusText is not null)
        {
            if (!v.Online) { _statusText.Text = v.Message ?? "Нет связи с сервером"; _statusText.Foreground = Brand.Brush(Brand.Warning); }
            else { _statusText.Text = v.Message ?? ""; _statusText.Foreground = Brand.Brush(Brand.TextSecond); }
        }

        if (_isPrimary) UpdateQr(v.QrImageBase64);
    }

    private void UpdateQr(string? data)
    {
        if (_qrImage is null || _qrFallback is null) return;
        var bmp = TryDecode(data);
        if (bmp is not null)
        {
            _qrImage.Source = bmp;
            _qrImage.Visibility = Visibility.Visible;
            _qrFallback.Visibility = Visibility.Collapsed;
        }
        else
        {
            _qrImage.Visibility = Visibility.Collapsed;
            _qrFallback.Visibility = Visibility.Visible;
        }
    }

    private static BitmapImage? TryDecode(string? data)
    {
        if (string.IsNullOrWhiteSpace(data)) return null;
        try
        {
            var b64 = data.Contains(',') ? data[(data.IndexOf(',') + 1)..] : data;
            var bytes = Convert.FromBase64String(b64);
            var bi = new BitmapImage();
            bi.BeginInit();
            bi.StreamSource = new MemoryStream(bytes);
            bi.CacheOption = BitmapCacheOption.OnLoad;
            bi.EndInit();
            bi.Freeze();
            return bi;
        }
        catch { return null; }
    }

    // --- positioning + un-closable ----------------------------------------
    private void OnSourceInitialized(object? sender, EventArgs e)
    {
        var b = _screen.Bounds; // device pixels
        var helper = new WindowInteropHelper(this);
        SetWindowPos(helper.Handle, HWND_TOP, b.Left, b.Top, b.Width, b.Height,
            SWP_NOACTIVATE);

        if (!_preview) // preview stays closable (Esc / Alt+F4)
            HwndSource.FromHwnd(helper.Handle)?.AddHook(WndProc);
    }

    private const int WM_CLOSE = 0x0010;
    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg == WM_CLOSE) { handled = true; return IntPtr.Zero; } // ignore Alt+F4 etc.
        return IntPtr.Zero;
    }

    private static readonly IntPtr HWND_TOP = IntPtr.Zero;
    private const uint SWP_NOACTIVATE = 0x0010;

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter,
        int X, int Y, int cx, int cy, uint uFlags);
}
