using System.Reflection;

namespace StopkekAgent.Tests;

/// <summary>
/// Minimal zero-dependency test runner. Finds every public parameterless method
/// marked [Test], runs it, prints PASS/FAIL, exits non-zero if anything failed.
/// Replaces xunit so the suite builds without nuget.org.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class TestAttribute : Attribute { }

public static class Assert
{
    public static void True(bool cond, string? msg = null)
    {
        if (!cond) throw new Exception("Expected true" + (msg is null ? "" : $": {msg}"));
    }

    public static void False(bool cond, string? msg = null) => True(!cond, msg);

    public static void Equal<T>(T expected, T actual)
    {
        if (!Equals(expected, actual))
            throw new Exception($"Expected <{expected}> but got <{actual}>");
    }

    public static void InRange(long value, long lo, long hi)
    {
        if (value < lo || value > hi)
            throw new Exception($"Expected {value} in [{lo}, {hi}]");
    }
}

public static class TestRunner
{
    public static int Main()
    {
        int passed = 0, failed = 0;
        var types = Assembly.GetExecutingAssembly().GetTypes();

        foreach (var type in types)
        {
            var tests = type.GetMethods(BindingFlags.Public | BindingFlags.Instance)
                .Where(m => m.GetCustomAttribute<TestAttribute>() is not null)
                .ToArray();
            if (tests.Length == 0) continue;

            foreach (var test in tests)
            {
                var name = $"{type.Name}.{test.Name}";
                try
                {
                    var instance = Activator.CreateInstance(type);
                    test.Invoke(instance, null);
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine($"  PASS  {name}");
                    passed++;
                }
                catch (Exception ex)
                {
                    var inner = ex is TargetInvocationException tie ? tie.InnerException! : ex;
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine($"  FAIL  {name}: {inner.Message}");
                    failed++;
                }
                finally
                {
                    Console.ResetColor();
                }
            }
        }

        Console.WriteLine();
        if (failed == 0)
        {
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine($"Passed!  - Passed: {passed}, Failed: 0");
        }
        else
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"FAILED!  - Passed: {passed}, Failed: {failed}");
        }
        Console.ResetColor();
        return failed == 0 ? 0 : 1;
    }
}
