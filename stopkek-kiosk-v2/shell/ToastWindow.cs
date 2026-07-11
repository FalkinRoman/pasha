using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Threading;
using Forms = System.Windows.Forms;

namespace StopkekShell;

/// <summary>
/// Non-activating toast that slides in from the right edge of the primary screen,
/// holds for a few seconds, then slides back out and closes itself. Topmost +
/// WS_EX_NOACTIVATE (same trick as <see cref="TimerWidget"/>) so it appears over a
/// running game without ever stealing focus. Purely visual — no policy decisions.
/// </summary>
public sealed class ToastWindow : Window
{
    private static readonly TimeSpan HoldFor = TimeSpan.FromSeconds(8);
    private static readonly TimeSpan SlideFor = TimeSpan.FromMilliseconds(280);

    private readonly DispatcherTimer _hold = new();
    private double _onScreenLeft;
    private double _offScreenLeft;

    public ToastWindow(string text)
    {
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        ShowInTaskbar = false;
        ShowActivated = false;
        Topmost = true;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        SizeToContent = SizeToContent.WidthAndHeight;
        Title = "stopKEK notify";

        var head = new TextBlock
        {
            Text = "Уведомление",
            FontSize = 11,
            Foreground = Brand.Brush(Brand.TextSecond),
            Margin = new Thickness(0, 0, 0, 4),
        };
        var msg = new TextBlock
        {
            Text = text,
            FontSize = 15,
            FontWeight = FontWeights.SemiBold,
            Foreground = Brand.Brush(Brand.Text),
            TextWrapping = TextWrapping.Wrap,
            MaxWidth = 320,
        };

        var panel = new StackPanel { Margin = new Thickness(18, 14, 18, 14) };
        panel.Children.Add(head);
        panel.Children.Add(msg);

        Content = new Border
        {
            Background = new SolidColorBrush(Color.FromArgb(0xF2, 0x0A, 0x0A, 0x0A)),
            BorderBrush = Brand.Brush(Brand.Accent),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(14),
            Child = panel,
        };

        _hold.Interval = HoldFor;
        _hold.Tick += (_, _) => { _hold.Stop(); SlideOut(); };

        SourceInitialized += OnSourceInitialized;
        Loaded += (_, _) => SlideIn();
    }

    private void SlideIn()
    {
        var wa = Forms.Screen.PrimaryScreen!.WorkingArea;
        Top = wa.Top + 24;
        _onScreenLeft = wa.Right - ActualWidth - 24;
        _offScreenLeft = wa.Right + 8;
        Left = _offScreenLeft;
        Animate(_offScreenLeft, _onScreenLeft, () => _hold.Start());
    }

    private void SlideOut() => Animate(_onScreenLeft, _offScreenLeft, Close);

    private void Animate(double from, double to, Action done)
    {
        var anim = new DoubleAnimation(from, to, SlideFor)
        {
            EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut },
        };
        anim.Completed += (_, _) => done();
        BeginAnimation(LeftProperty, anim);
    }

    // --- non-activating, tool window (mirrors TimerWidget) -----------------
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
