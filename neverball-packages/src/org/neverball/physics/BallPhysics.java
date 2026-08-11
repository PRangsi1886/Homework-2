package org.neverball.physics;

import org.neverball.level.Level;
import org.neverball.util.Vec2;

/**
 * Ball on a tilted plane — Neverball-style controls.
 * Player tilts the floor; gravity projects onto XZ; walls block; falling ends the attempt.
 */
public final class BallPhysics {
    public static final double BALL_RADIUS = 0.35;
    public static final double MAX_TILT = Math.toRadians(22);
    public static final double TILT_SPEED = Math.toRadians(55);
    public static final double GRAVITY = 18.0;
    /** Rolling resistance (too high cancels slope acceleration from rest). */
    public static final double FRICTION = 0.22;
    public static final double MAX_SPEED = 14.0;

    public final Vec2 pos = new Vec2();
    public final Vec2 vel = new Vec2();
    public double tiltX; // rotation around X => rolls along +Z
    public double tiltZ; // rotation around Z => rolls along -X / +X

    public double targetTiltX;
    public double targetTiltZ;

    public void reset(Level level) {
        pos.set(level.spawnX, level.spawnZ);
        vel.set(0, 0);
        tiltX = tiltZ = 0;
        targetTiltX = targetTiltZ = 0;
    }

    public void setInput(boolean left, boolean right, boolean up, boolean down) {
        double tx = 0;
        double tz = 0;
        if (left) {
            tz += MAX_TILT;
        }
        if (right) {
            tz -= MAX_TILT;
        }
        if (up) {
            tx -= MAX_TILT;
        }
        if (down) {
            tx += MAX_TILT;
        }
        // clamp combined magnitude
        double mag = Math.hypot(tx, tz);
        if (mag > MAX_TILT) {
            tx = tx / mag * MAX_TILT;
            tz = tz / mag * MAX_TILT;
        }
        targetTiltX = tx;
        targetTiltZ = tz;
    }

    /**
     * @return true if still on the course
     */
    public boolean step(Level level, double dt) {
        tiltX = approach(tiltX, targetTiltX, TILT_SPEED * dt);
        tiltZ = approach(tiltZ, targetTiltZ, TILT_SPEED * dt);

        // Acceleration from gravity on tilted plane
        double ax = GRAVITY * Math.sin(tiltZ);
        double az = -GRAVITY * Math.sin(tiltX);
        vel.x += ax * dt;
        vel.y += az * dt;

        // Friction opposing velocity
        double speed = vel.length();
        if (speed > 1e-6) {
            double decel = FRICTION * GRAVITY * Math.cos(Math.hypot(tiltX, tiltZ)) * dt;
            double ns = Math.max(0, speed - decel);
            vel.scale(ns / speed);
        }
        speed = vel.length();
        if (speed > MAX_SPEED) {
            vel.scale(MAX_SPEED / speed);
        }

        pos.x += vel.x * dt;
        pos.y += vel.y * dt;

        resolveWalls(level);

        return level.onSolidGround(pos.x, pos.y, BALL_RADIUS);
    }

    private void resolveWalls(Level level) {
        for (Level.Wall w : level.walls) {
            resolveAabb(w.x, w.z, w.w, w.d);
        }
    }

    private void resolveAabb(double x, double z, double w, double d) {
        double cx = clamp(pos.x, x, x + w);
        double cz = clamp(pos.y, z, z + d);
        double dx = pos.x - cx;
        double dz = pos.y - cz;
        double dist2 = dx * dx + dz * dz;
        double r = BALL_RADIUS;
        if (dist2 >= r * r) {
            return;
        }
        if (dist2 < 1e-10) {
            // Center inside — push out via nearest face
            double left = Math.abs(pos.x - x);
            double right = Math.abs((x + w) - pos.x);
            double top = Math.abs(pos.y - z);
            double bottom = Math.abs((z + d) - pos.y);
            double m = Math.min(Math.min(left, right), Math.min(top, bottom));
            if (m == left) {
                pos.x = x - r;
                vel.x = Math.min(0, vel.x) * -0.35;
            } else if (m == right) {
                pos.x = x + w + r;
                vel.x = Math.max(0, vel.x) * -0.35;
            } else if (m == top) {
                pos.y = z - r;
                vel.y = Math.min(0, vel.y) * -0.35;
            } else {
                pos.y = z + d + r;
                vel.y = Math.max(0, vel.y) * -0.35;
            }
            return;
        }
        double dist = Math.sqrt(dist2);
        double nx = dx / dist;
        double nz = dz / dist;
        pos.x = cx + nx * r;
        pos.y = cz + nz * r;
        double vn = vel.x * nx + vel.y * nz;
        if (vn < 0) {
            vel.x -= (1.35) * vn * nx;
            vel.y -= (1.35) * vn * nz;
        }
    }

    private static double approach(double current, double target, double maxDelta) {
        double d = target - current;
        if (Math.abs(d) <= maxDelta) {
            return target;
        }
        return current + Math.signum(d) * maxDelta;
    }

    private static double clamp(double v, double lo, double hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
