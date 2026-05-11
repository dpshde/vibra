const std = @import("std");
const runner = @import("runner");
const zero_native = @import("zero-native");

pub const panic = std.debug.FullPanic(zero_native.debug.capturePanic);

/// Minimal bridge handler for plugin/patch save/load scaffolding.
/// Expand this registry to add native file-system commands.
fn echoHandler(context: *anyopaque, invocation: zero_native.bridge.Invocation, output: []u8) anyerror![]const u8 {
    _ = context;
    return std.fmt.bufPrint(output, "{{\"echo\":{s}}}", .{invocation.request.payload}) catch return error.OutOfSpace;
}

const bridge_handlers = [_]zero_native.BridgeHandler{
    .{
        .name = "echo",
        .context = undefined,
        .invoke_fn = echoHandler,
    },
};

const bridge_registry = zero_native.BridgeRegistry{ .handlers = &bridge_handlers };

const bridge_dispatcher = zero_native.BridgeDispatcher{
    .registry = bridge_registry,
    .policy = .{
        .enabled = true,
        .permissions = &[_][]const u8{"bridge"},
        .commands = &[_]zero_native.BridgeCommandPolicy{
            .{ .name = "echo", .permissions = &[_][]const u8{"bridge"} },
        },
    },
};

const App = struct {
    env_map: *std.process.Environ.Map,

    fn app(self: *@This()) zero_native.App {
        return .{
            .context = self,
            .name = "vibra",
            .source = zero_native.frontend.productionSource(.{ .dist = "frontend/dist" }),
            .source_fn = source,
        };
    }

    fn source(context: *anyopaque) anyerror!zero_native.WebViewSource {
        const self: *@This() = @ptrCast(@alignCast(context));
        return zero_native.frontend.sourceFromEnv(self.env_map, .{
            .dist = "frontend/dist",
            .entry = "index.html",
        });
    }
};

const dev_origins = [_][]const u8{ "zero://app", "zero://inline", "http://127.0.0.1:5173" };

pub fn main(init: std.process.Init) !void {
    var app = App{ .env_map = init.environ_map };
    try runner.runWithOptions(app.app(), .{
        .app_name = "Vibra",
        .window_title = "Vibra",
        .bundle_id = "dev.zero_native.vibra",
        .icon_path = "assets/icon.icns",
        .bridge = bridge_dispatcher,
        .builtin_bridge = .{
            .enabled = true,
            .permissions = &[_][]const u8{"bridge"},
        },
        .security = .{
            .navigation = .{ .allowed_origins = &dev_origins },
        },
    }, init);
}

test "app name is configured" {
    try std.testing.expectEqualStrings("vibra", "vibra");
}
