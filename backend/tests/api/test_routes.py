"""Test that routes are registered."""


def test_routes_registered(client):
    """Print registered routes for debugging."""
    from app.main import app

    routes = {}
    for route in app.routes:
        path = getattr(route, 'path', 'unknown')
        methods = getattr(route, 'methods', set())
        routes[path] = methods

    # Print all routes
    for path in sorted(routes.keys()):
        print(f"{path}: {routes[path]}")

    # Check that key routes exist
    assert any('portfolio' in p for p in routes.keys()), f"No portfolio route found. Routes: {list(routes.keys())}"
    assert any('watchlist' in p for p in routes.keys()), f"No watchlist route found. Routes: {list(routes.keys())}"
