using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;
using Forms = System.Windows.Forms;

namespace StopkekShell;

/// <summary>
/// Small always-on-top, non-activating widget shown WHILE the player games. It does
/// not steal focus (WS_EX_NOACTIVATE) so it never interrupts a match. Shows the time
/// left, a warning toast, and a two-step "end session" button. In GRACE it turns into
/// a calm "time's up" banner without blocking the game.
/// </summary>
public sealed class TimerWidget : Window
{
    private readonly Action _onEndSession;
    private readonly TextBlock _time = new();
    private readonly TextBlock _label = new();
    private readonly TextBlock _notice = new();
    private readonly Button _endBtn = new();
    private readonly Border _card;

    private bool _confirming;
    private readonly DispatcherTimer _confirmReset = new() { Interval = TimeSpan.FromSeconds(4) };

    public TimerWidget(Action onEndSession)
    {
        _onEndSession = onEndSession;

        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        ShowInTaskbar = false;
        Topmost = true;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        SizeToContent = SizeToContent.WidthAndHeight;
        Title = "stopKEK timer";

        _time.FontSize = 30; _time.FontWeight = FontWeights.Bold;
        _time.Foreground = Brand.Brush(Brand.Text);
        _time.HorizontalAlignment = System.Windows.HorizontalAlignment.Center;

        _label.FontSize = 12; _label.Foreground = Brand.Brush(Brand.TextSecond);
        _label.HorizontalAlignment = System.Windows.HorizontalAlignment.Center;

        _notice.FontSize = 12; _notice.Foreground = Brand.Brush(Brand.Warning);
        _notice.TextWrapping = TextWrapping.Wrap; _notice.TextAlignment = TextAlignment.Center;
        _notice.MaxWidth = 220; _notice.Visibility = Visibility.Collapsed;
        _notice.Margin = new Thickness(0, 6, 0, 0);

        _endBtn.Content = "Завершить сеанс";
        _endBtn.FontSize = 12;
        _endBtn.Margin = new Thickness(0, 10, 0, 0);
        _endBtn.Padding = new Thickness(10, 5, 10, 5);
        _endBtn.Background = Brand.Brush(Brand.BgCard);
        _endBtn.Foreground = Brand.Brush(Brand.TextSecond);
        _endBtn.BorderBrush = Brand.Brush(Brand.Border);
        _endBtn.Cursor = System.Windows.Input.Cursors.Hand;
        _endBtn.Click += EndClicked;

        var panel = new StackPanel { Margin = new Thickness(18, 14, 18, 14) };
        panel.Children.Add(_time);
        panel.Children.Add(_label);
        panel.Children.Add(_notice);
        panel.Children.Add(_endBtn);

        _card = new Border
        {
            Background = new SolidColorBrush(Color.FromArgb(0xE6, 0x0A, 0x0A, 0x0A)),
            BorderBrush = Brand.Brush(Brand.Border),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(14),
            Child = panel,
        };
        Content = _card;

        _confirmReset.Tick += (_, _) => ResetConfirm();
        SourceInitialized += OnSourceInitialized;
        Loaded += (_, _) => PositionTopRight();
    }

    private void EndClicked(object sender, RoutedEventArgs e)
    {
        if (!_confirming)
        {
            _confirming = true;
            _endBtn.Content = "Точно? Оплата сгорит — нажмите ещё раз";
            _endBtn.Foreground = Brand.Brush(Brand.AccentBright);
            _confirmReset.Start();
            return;
        }
        ResetConfirm();
        _onEndSession();
    }

    private void ResetConfirm()
    {
        _confirmReset.Stop();
        _confirming = false;
        _endBtn.Content = "Завершить сеанс";
        _endBtn.Foreground = Brand.Brush(Brand.TextSecond);
    }

    public void UpdateView(KioskView v)
    {
        if (v.Mode == KioskMode.Grace)
        {
            _time.Text = "Время вышло";
            _time.Foreground = Brand.Brush(Brand.AccentBright);
            _label.Text = "Можно доиграть — продлите в приложении";
            _card.BorderBrush = Brand.Brush(Brand.Accent);
        }
        else
        {
            _time.Text = Format(v.RemainingMs);
            _time.Foreground = v.RemainingMs <= 5 * 60_000
                ? Brand.Brush(Brand.Warning) : Brand.Brush(Brand.Text);
            _label.Text = $"Место #{v.SeatNumber}" + (v.ZoneName is null ? "" : $" · {v.ZoneName}");
            _card.BorderBrush = Brand.Brush(Brand.Border);
        }

        if (string.IsNullOrEmpty(v.Notice)) _notice.Visibility = Visibility.Collapsed;
        else { _notice.Text = v.Notice; _notice.Visibility = Visibility.Visible; }
    }

    private static string Format(long ms)
    {
        if (ms < 0) ms = 0;
        var t = TimeSpan.FromMilliseconds(ms);
        return t.Hours > 0 ? $"{t.Hours}:{t.Minutes:00}:{t.Seconds:00}" : $"{t.Minutes}:{t.Seconds:00}";
    }

    private void PositionTopRight()
    {
        var wa = Forms.Screen.PrimaryScreen!.WorkingArea;
        Left = wa.Right - ActualWidth - 24;
        Top = wa.Top + 24;
    }

    // --- non-activating, tool window --------------------------------------
    private const int GWL_EXSTYLE = -20;
    private const int WS_EX_NOACTIVATE = 0x08000000;
    private const int WS_EX_TOOLWINDOW = 0x00000080;

    private void OnSourceInitialized(object? sender, EventArgs e)
    {
        var h = new WindowInteropHelper(this).Handle;
        int ex = GetWindowLong(h, GWL_EXSTYLE);
        SetWindowLong(h, GWL_EXSTYLE, ex | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW);
    }

    [DllImport("user32.dll")] private static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll")] private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
}
