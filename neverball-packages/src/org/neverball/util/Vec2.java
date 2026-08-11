package org.neverball.util;

/** Simple mutable 2D vector (XZ plane helpers use x/z naming in callers). */
public final class Vec2 {
    public double x;
    public double y;

    public Vec2() {}

    public Vec2(double x, double y) {
        this.x = x;
        this.y = y;
    }

    public Vec2 set(double x, double y) {
        this.x = x;
        this.y = y;
        return this;
    }

    public Vec2 add(double dx, double dy) {
        x += dx;
        y += dy;
        return this;
    }

    public double length() {
        return Math.hypot(x, y);
    }

    public Vec2 scale(double s) {
        x *= s;
        y *= s;
        return this;
    }

    public Vec2 copy() {
        return new Vec2(x, y);
    }
}
