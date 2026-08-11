package org.neverball.ui;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Ellipse2D;
import java.awt.geom.Path2D;

import org.neverball.game.GameSession;
import org.neverball.level.Level;
import org.neverball.physics.BallPhysics;

/** Perspective-ish painter for the tilted course. */
public final class CourseRenderer {
    private static final Color SKY_TOP = new Color(120, 186, 230);
    private static final Color SKY_BOT = new Color(214, 236, 250);
    private static final Color VOID = new Color(28, 48, 72);
    private static final Color TURF = new Color(62, 150, 78);
    private static final Color TURF_DARK = new Color(44, 112, 58);
    private static final Color EDGE = new Color(36, 78, 44);
    private static final Color WALL = new Color(168, 156, 140);
    private static final Color WALL_TOP = new Color(210, 200, 185);
    private static final Color HAZARD = new Color(40, 40, 48, 200);
    private static final Color GOAL_LOCKED = new Color(90, 90, 100, 160);
    private static final Color GOAL_OPEN = new Color(255, 220, 70, 200);

    private double camX;
    private double camZ;

    public void paint(Graphics2D g, int width, int height, GameSession session, double anim) {
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        paintSky(g, width, height);

        Level level = session.level;
        BallPhysics ball = session.ball;
        camX += (ball.pos.x - camX) * 0.12;
        camZ += (ball.pos.y - camZ) * 0.12;

        double tiltVisX = ball.tiltX;
        double tiltVisZ = ball.tiltZ;

        // Draw platforms from back to front (larger Z first in screen space roughly)
        level.platforms.stream()
                .sorted((a, b) -> Double.compare(a.z + a.d, b.z + b.d))
                .forEach(p -> drawPlatform(g, width, height, p, tiltVisX, tiltVisZ));

        for (Level.Hazard h : level.hazards) {
            drawHazard(g, width, height, h, tiltVisX, tiltVisZ);
        }
        for (Level.Wall w : level.walls) {
            drawWall(g, width, height, w, tiltVisX, tiltVisZ);
        }
        for (Level.Coin c : level.coins) {
            if (!c.taken) {
                drawCoin(g, width, height, c, tiltVisX, tiltVisZ, anim);
            }
        }
        drawGoal(g, width, height, level.goal, session.goalOpen, tiltVisX, tiltVisZ, anim);
        drawBall(g, width, height, ball, tiltVisX, tiltVisZ);

        // Soft vignette / void hint
        g.setColor(new Color(0, 0, 0, 40));
        g.fillRect(0, 0, width, 28);
        g.fillRect(0, height - 28, width, 28);
    }

    private void paintSky(Graphics2D g, int w, int h) {
        for (int y = 0; y < h; y++) {
            float t = y / (float) h;
            int r = (int) (SKY_TOP.getRed() * (1 - t) + SKY_BOT.getRed() * t);
            int gr = (int) (SKY_TOP.getGreen() * (1 - t) + SKY_BOT.getGreen() * t);
            int b = (int) (SKY_TOP.getBlue() * (1 - t) + SKY_BOT.getBlue() * t);
            g.setColor(new Color(r, gr, b));
            g.drawLine(0, y, w, y);
        }
        // distant hills
        g.setColor(new Color(90, 140, 110, 90));
        Path2D hills = new Path2D.Double();
        hills.moveTo(0, h * 0.55);
        for (int x = 0; x <= w; x += 40) {
            double yy = h * 0.52 + Math.sin(x * 0.01) * 28 + Math.cos(x * 0.023) * 18;
            hills.lineTo(x, yy);
        }
        hills.lineTo(w, h);
        hills.lineTo(0, h);
        hills.closePath();
        g.fill(hills);
        g.setColor(VOID);
    }

    private void drawPlatform(
            Graphics2D g, int w, int h, Level.Platform p, double tx, double tz) {
        double x0 = p.x;
        double z0 = p.z;
        double x1 = p.x + p.w;
        double z1 = p.z + p.d;
        int[] xs = new int[4];
        int[] ys = new int[4];
        projectQuad(xs, ys, w, h, x0, z0, x1, z0, x1, z1, x0, z1, tx, tz, 0);

        g.setColor(TURF);
        g.fillPolygon(xs, ys, 4);
        g.setColor(EDGE);
        g.setStroke(new BasicStroke(2f));
        g.drawPolygon(xs, ys, 4);

        // side face for depth
        int[] sx = {xs[2], xs[3], xs[3], xs[2]};
        int[] sy = {ys[2], ys[3], ys[3] + 14, ys[2] + 14};
        // recompute bottom edge with lower Y
        double[] a = project(x1, z1, tx, tz, -0.55);
        double[] b = project(x0, z1, tx, tz, -0.55);
        int[] screenA = toScreen(a[0], a[1], a[2], w, h);
        int[] screenB = toScreen(b[0], b[1], b[2], w, h);
        int[] sideX = {xs[2], xs[3], screenB[0], screenA[0]};
        int[] sideY = {ys[2], ys[3], screenB[1], screenA[1]};
        g.setColor(TURF_DARK);
        g.fillPolygon(sideX, sideY, 4);
    }

    private void drawWall(Graphics2D g, int w, int h, Level.Wall wall, double tx, double tz) {
        double x0 = wall.x;
        double z0 = wall.z;
        double x1 = wall.x + wall.w;
        double z1 = wall.z + wall.d;
        int[] xs = new int[4];
        int[] ys = new int[4];
        projectQuad(xs, ys, w, h, x0, z0, x1, z0, x1, z1, x0, z1, tx, tz, 0.9);
        g.setColor(WALL_TOP);
        g.fillPolygon(xs, ys, 4);
        int[] baseXs = new int[4];
        int[] baseYs = new int[4];
        projectQuad(baseXs, baseYs, w, h, x0, z0, x1, z0, x1, z1, x0, z1, tx, tz, 0);
        g.setColor(WALL);
        g.fillPolygon(
                new int[] {xs[0], xs[1], baseXs[1], baseXs[0]},
                new int[] {ys[0], ys[1], baseYs[1], baseYs[0]},
                4);
        g.fillPolygon(
                new int[] {xs[1], xs[2], baseXs[2], baseXs[1]},
                new int[] {ys[1], ys[2], baseYs[2], baseYs[1]},
                4);
    }

    private void drawHazard(Graphics2D g, int w, int h, Level.Hazard hz, double tx, double tz) {
        int[] xs = new int[4];
        int[] ys = new int[4];
        projectQuad(
                xs, ys, w, h, hz.x, hz.z, hz.x + hz.w, hz.z, hz.x + hz.w, hz.z + hz.d, hz.x,
                hz.z + hz.d, tx, tz, 0.02);
        g.setColor(HAZARD);
        g.fillPolygon(xs, ys, 4);
        g.setColor(new Color(220, 80, 70, 120));
        g.setStroke(new BasicStroke(2f));
        g.drawPolygon(xs, ys, 4);
    }

    private void drawCoin(
            Graphics2D g, int w, int h, Level.Coin c, double tx, double tz, double anim) {
        double bob = Math.sin(anim * 4 + c.x + c.z) * 0.12;
        double[] p = project(c.x, c.z, tx, tz, 0.45 + bob);
        int[] s = toScreen(p[0], p[1], p[2], w, h);
        Color fill =
                switch (c.value) {
                    case 10 -> new Color(70, 140, 255);
                    case 5 -> new Color(230, 70, 70);
                    default -> new Color(255, 210, 50);
                };
        double scale = 18 / Math.max(0.55, p[2]);
        g.setColor(new Color(0, 0, 0, 60));
        g.fill(new Ellipse2D.Double(s[0] - scale * 0.7, s[1] + scale * 0.4, scale * 1.4, scale * 0.5));
        g.setColor(fill);
        g.fill(new Ellipse2D.Double(s[0] - scale * 0.55, s[1] - scale * 0.55, scale * 1.1, scale * 1.1));
        g.setColor(Color.WHITE);
        g.fill(new Ellipse2D.Double(s[0] - scale * 0.2, s[1] - scale * 0.35, scale * 0.35, scale * 0.25));
    }

    private void drawGoal(
            Graphics2D g,
            int w,
            int h,
            Level.Goal goal,
            boolean open,
            double tx,
            double tz,
            double anim) {
        double pulse = open ? 0.15 * Math.sin(anim * 6) : 0;
        double r = goal.radius + pulse;
        int segments = 24;
        int[] xs = new int[segments];
        int[] ys = new int[segments];
        for (int i = 0; i < segments; i++) {
            double a = i * Math.PI * 2 / segments;
            double gx = goal.x + Math.cos(a) * r;
            double gz = goal.z + Math.sin(a) * r;
            double[] p = project(gx, gz, tx, tz, open ? 0.05 : 0.02);
            int[] s = toScreen(p[0], p[1], p[2], w, h);
            xs[i] = s[0];
            ys[i] = s[1];
        }
        g.setColor(open ? GOAL_OPEN : GOAL_LOCKED);
        g.fillPolygon(xs, ys, segments);
        g.setStroke(new BasicStroke(open ? 3f : 2f));
        g.setColor(open ? new Color(255, 255, 180) : new Color(160, 160, 180));
        g.drawPolygon(xs, ys, segments);
        if (open) {
            double[] c = project(goal.x, goal.z, tx, tz, 1.2 + Math.sin(anim * 5) * 0.2);
            int[] s = toScreen(c[0], c[1], c[2], w, h);
            g.setColor(new Color(255, 240, 120, 180));
            g.setFont(new Font("SansSerif", Font.BOLD, 14));
            g.drawString("EXIT", s[0] - 16, s[1]);
        }
    }

    private void drawBall(Graphics2D g, int w, int h, BallPhysics ball, double tx, double tz) {
        double[] p = project(ball.pos.x, ball.pos.y, tx, tz, BallPhysics.BALL_RADIUS);
        int[] s = toScreen(p[0], p[1], p[2], w, h);
        double scale = (28 * BallPhysics.BALL_RADIUS * 2) / Math.max(0.5, p[2]);
        // shadow
        double[] sh = project(ball.pos.x, ball.pos.y, tx, tz, 0.02);
        int[] ss = toScreen(sh[0], sh[1], sh[2], w, h);
        g.setColor(new Color(0, 0, 0, 70));
        g.fill(new Ellipse2D.Double(ss[0] - scale * 0.7, ss[1] - scale * 0.25, scale * 1.4, scale * 0.55));
        // ball
        g.setColor(new Color(230, 70, 55));
        g.fill(new Ellipse2D.Double(s[0] - scale / 2, s[1] - scale / 2, scale, scale));
        g.setColor(new Color(255, 170, 150));
        g.fill(new Ellipse2D.Double(s[0] - scale * 0.28, s[1] - scale * 0.35, scale * 0.35, scale * 0.28));
        g.setColor(new Color(120, 30, 25));
        g.setStroke(new BasicStroke(1.5f));
        g.draw(new Ellipse2D.Double(s[0] - scale / 2, s[1] - scale / 2, scale, scale));
    }

    private void projectQuad(
            int[] xs,
            int[] ys,
            int w,
            int h,
            double x0,
            double z0,
            double x1,
            double z1,
            double x2,
            double z2,
            double x3,
            double z3,
            double tx,
            double tz,
            double y) {
        double[][] pts = {
            project(x0, z0, tx, tz, y),
            project(x1, z1, tx, tz, y),
            project(x2, z2, tx, tz, y),
            project(x3, z3, tx, tz, y)
        };
        for (int i = 0; i < 4; i++) {
            int[] s = toScreen(pts[i][0], pts[i][1], pts[i][2], w, h);
            xs[i] = s[0];
            ys[i] = s[1];
        }
    }

    /** Rotate world by floor tilt, then perspective project. Returns eye-space x,y,z. */
    private double[] project(double x, double z, double tiltX, double tiltZ, double y) {
        double lx = x - camX;
        double lz = z - camZ;
        // apply tilt rotations (floor tilts under the ball)
        double y1 = y * Math.cos(tiltX) - lz * Math.sin(tiltX);
        double z1 = y * Math.sin(tiltX) + lz * Math.cos(tiltX);
        double x2 = lx * Math.cos(tiltZ) + y1 * Math.sin(tiltZ);
        double y2 = -lx * Math.sin(tiltZ) + y1 * Math.cos(tiltZ);
        double z2 = z1;

        // camera sits above and behind looking toward -Z-ish
        double eyeX = x2;
        double eyeY = y2 + 7.5;
        double eyeZ = z2 + 12.0;
        return new double[] {eyeX, eyeY, eyeZ};
    }

    private int[] toScreen(double ex, double ey, double ez, int w, int h) {
        double z = Math.max(0.35, ez);
        double f = 420;
        int sx = (int) (w * 0.5 + (ex * f) / z);
        int sy = (int) (h * 0.42 - (ey * f) / z);
        return new int[] {sx, sy};
    }
}
