package org.neverball.game;

import org.neverball.level.Level;
import org.neverball.physics.BallPhysics;

/** Pure game rules for one level attempt. */
public final class GameSession {
    public enum Status {
        PLAYING,
        WON,
        FELL,
        TIME_UP
    }

    public final Level level;
    public final BallPhysics ball = new BallPhysics();
    public Status status = Status.PLAYING;
    public int coins;
    public int lives = 3;
    public double timeLeft;
    public boolean goalOpen;
    public String banner = "";

    public GameSession(Level level) {
        this.level = level;
        restartAttempt(true);
    }

    public void restartAttempt(boolean fullResetLives) {
        if (fullResetLives) {
            lives = 3;
        }
        level.resetCoins();
        coins = 0;
        timeLeft = level.timeLimit;
        goalOpen = false;
        status = Status.PLAYING;
        banner = level.message == null ? "" : level.message;
        ball.reset(level);
    }

    public void update(double dt, boolean left, boolean right, boolean up, boolean down) {
        if (status != Status.PLAYING) {
            return;
        }
        ball.setInput(left, right, up, down);
        boolean onGround = ball.step(level, dt);
        collectCoins();
        goalOpen = coins >= level.goalCoins;
        if (goalOpen && nearGoal()) {
            status = Status.WON;
            banner = "Goal!";
            return;
        }
        timeLeft -= dt;
        if (timeLeft <= 0) {
            timeLeft = 0;
            status = Status.TIME_UP;
            banner = "Time's up!";
            loseLife();
            return;
        }
        if (!onGround) {
            status = Status.FELL;
            banner = "Fell away!";
            loseLife();
        }
    }

    private void loseLife() {
        lives = Math.max(0, lives - 1);
    }

    private void collectCoins() {
        double r = BallPhysics.BALL_RADIUS + 0.35;
        for (Level.Coin c : level.coins) {
            if (c.taken) {
                continue;
            }
            double dx = ball.pos.x - c.x;
            double dz = ball.pos.y - c.z;
            if (dx * dx + dz * dz <= r * r) {
                c.taken = true;
                coins += c.value;
            }
        }
    }

    private boolean nearGoal() {
        double dx = ball.pos.x - level.goal.x;
        double dz = ball.pos.y - level.goal.z;
        double r = level.goal.radius + BallPhysics.BALL_RADIUS * 0.5;
        return dx * dx + dz * dz <= r * r;
    }
}
