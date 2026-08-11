package org.neverball.ui;

import java.awt.Color;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import javax.swing.JPanel;
import javax.swing.Timer;

import org.neverball.game.GameSession;
import org.neverball.level.Level;
import org.neverball.level.LevelLoader;
import org.neverball.level.PackageSet;

public final class GamePanel extends JPanel {
    private enum Screen {
        TITLE,
        PLAY
    }

    private final Path packagesRoot;
    private final List<PackageSet> sets;
    private final CourseRenderer renderer = new CourseRenderer();
    private final Set<Integer> keys = new HashSet<>();

    private Screen screen = Screen.TITLE;
    private int setIndex;
    private int levelIndex;
    private GameSession session;
    private String error = "";
    private double anim;
    private long lastNanos = System.nanoTime();

    public GamePanel(Path packagesRoot, List<PackageSet> sets) {
        this.packagesRoot = packagesRoot;
        this.sets = sets;
        setPreferredSize(new Dimension(960, 640));
        setBackground(new Color(20, 30, 45));
        setFocusable(true);

        addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                keys.add(e.getKeyCode());
                handleKey(e.getKeyCode());
            }

            @Override
            public void keyReleased(KeyEvent e) {
                keys.remove(e.getKeyCode());
            }
        });

        Timer timer = new Timer(16, e -> tick());
        timer.start();
    }

    private void handleKey(int code) {
        if (screen == Screen.TITLE) {
            if (code == KeyEvent.VK_ENTER || code == KeyEvent.VK_SPACE) {
                startLevel(0, 0);
            } else if (code == KeyEvent.VK_DOWN || code == KeyEvent.VK_S) {
                setIndex = Math.min(sets.size() - 1, setIndex + 1);
            } else if (code == KeyEvent.VK_UP || code == KeyEvent.VK_W) {
                setIndex = Math.max(0, setIndex - 1);
            } else if (code == KeyEvent.VK_ESCAPE) {
                System.exit(0);
            }
            return;
        }

        if (code == KeyEvent.VK_ESCAPE) {
            screen = Screen.TITLE;
            session = null;
            return;
        }
        if (code == KeyEvent.VK_R) {
            if (session != null) {
                session.restartAttempt(true);
            }
            return;
        }
        if (session == null) {
            return;
        }
        if (code == KeyEvent.VK_ENTER || code == KeyEvent.VK_SPACE) {
            if (session.status == GameSession.Status.WON) {
                nextLevel();
            } else if (session.status == GameSession.Status.FELL
                    || session.status == GameSession.Status.TIME_UP) {
                if (session.lives > 0) {
                    session.restartAttempt(false);
                } else {
                    session.restartAttempt(true);
                }
            }
        }
        if (code == KeyEvent.VK_N && session.status == GameSession.Status.WON) {
            nextLevel();
        }
    }

    private void startLevel(int sIdx, int lIdx) {
        if (sets.isEmpty()) {
            error = "No package sets found under " + packagesRoot;
            return;
        }
        setIndex = Math.floorMod(sIdx, sets.size());
        PackageSet set = sets.get(setIndex);
        if (set.mapFiles.isEmpty()) {
            error = "Set has no maps: " + set.folderName;
            return;
        }
        levelIndex = Math.floorMod(lIdx, set.mapFiles.size());
        try {
            Level level = LevelLoader.load(set.mapFiles.get(levelIndex));
            session = new GameSession(level);
            screen = Screen.PLAY;
            error = "";
        } catch (Exception ex) {
            error = ex.getMessage();
            screen = Screen.TITLE;
        }
    }

    private void nextLevel() {
        PackageSet set = sets.get(setIndex);
        if (levelIndex + 1 < set.mapFiles.size()) {
            startLevel(setIndex, levelIndex + 1);
        } else if (setIndex + 1 < sets.size()) {
            startLevel(setIndex + 1, 0);
        } else {
            screen = Screen.TITLE;
            session = null;
        }
    }

    private void tick() {
        long now = System.nanoTime();
        double dt = Math.min(0.05, (now - lastNanos) / 1_000_000_000.0);
        lastNanos = now;
        anim += dt;

        if (screen == Screen.PLAY && session != null) {
            boolean left = keys.contains(KeyEvent.VK_LEFT) || keys.contains(KeyEvent.VK_A);
            boolean right = keys.contains(KeyEvent.VK_RIGHT) || keys.contains(KeyEvent.VK_D);
            boolean up = keys.contains(KeyEvent.VK_UP) || keys.contains(KeyEvent.VK_W);
            boolean down = keys.contains(KeyEvent.VK_DOWN) || keys.contains(KeyEvent.VK_S);
            session.update(dt, left, right, up, down);
        }
        repaint();
    }

    @Override
    protected void paintComponent(Graphics graphics) {
        super.paintComponent(graphics);
        Graphics2D g = (Graphics2D) graphics;
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(
                RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

        if (screen == Screen.TITLE) {
            paintTitle(g);
            return;
        }
        if (session != null) {
            renderer.paint(g, getWidth(), getHeight(), session, anim);
            paintHud(g);
            paintOverlay(g);
        }
    }

    private void paintTitle(Graphics2D g) {
        int w = getWidth();
        int h = getHeight();
        for (int y = 0; y < h; y++) {
            float t = y / (float) h;
            g.setColor(new Color(
                    (int) (24 + 40 * t),
                    (int) (48 + 70 * t),
                    (int) (72 + 50 * t)));
            g.drawLine(0, y, w, y);
        }

        g.setColor(new Color(255, 245, 230));
        g.setFont(new Font("Serif", Font.BOLD, 52));
        String title = "Neverball Packages";
        int tw = g.getFontMetrics().stringWidth(title);
        g.drawString(title, (w - tw) / 2, h / 5);

        g.setFont(new Font("SansSerif", Font.PLAIN, 18));
        g.setColor(new Color(220, 230, 240));
        String sub = "Java tilt-ball tribute · addon sets like Neverball/packages";
        int sw = g.getFontMetrics().stringWidth(sub);
        g.drawString(sub, (w - sw) / 2, h / 5 + 36);

        int boxY = h / 3;
        g.setColor(new Color(0, 0, 0, 90));
        g.fillRoundRect(w / 2 - 260, boxY, 520, Math.min(280, 80 + sets.size() * 36), 18, 18);

        g.setFont(new Font("SansSerif", Font.BOLD, 16));
        for (int i = 0; i < sets.size(); i++) {
            PackageSet set = sets.get(i);
            boolean sel = i == setIndex;
            g.setColor(sel ? new Color(255, 210, 90) : new Color(230, 235, 240));
            String line = (sel ? "▸ " : "  ") + set.title
                    + "  (" + set.mapFiles.size() + " maps"
                    + (set.difficulty.isEmpty() ? "" : " · " + set.difficulty) + ")";
            g.drawString(line, w / 2 - 230, boxY + 40 + i * 36);
            if (!set.author.isEmpty()) {
                g.setFont(new Font("SansSerif", Font.PLAIN, 12));
                g.setColor(new Color(190, 200, 210));
                g.drawString("by " + set.author, w / 2 - 210, boxY + 56 + i * 36);
                g.setFont(new Font("SansSerif", Font.BOLD, 16));
            }
        }

        g.setColor(new Color(240, 245, 250));
        g.setFont(new Font("SansSerif", Font.PLAIN, 15));
        String help = "↑↓ choose set   Enter play   Esc quit";
        g.drawString(help, (w - g.getFontMetrics().stringWidth(help)) / 2, h - 48);

        if (!error.isEmpty()) {
            g.setColor(new Color(255, 120, 120));
            g.drawString(error, 40, h - 20);
        }
    }

    private void paintHud(Graphics2D g) {
        PackageSet set = sets.get(setIndex);
        g.setColor(new Color(0, 0, 0, 110));
        g.fillRoundRect(16, 12, 320, 92, 14, 14);
        g.setColor(Color.WHITE);
        g.setFont(new Font("SansSerif", Font.BOLD, 16));
        g.drawString(session.level.name, 28, 36);
        g.setFont(new Font("SansSerif", Font.PLAIN, 13));
        g.drawString(set.title + "  ·  " + (levelIndex + 1) + "/" + set.mapFiles.size(), 28, 56);
        g.drawString(
                String.format(
                        "Coins %d / %d     Time %.1fs     Balls %d",
                        session.coins,
                        session.level.goalCoins,
                        session.timeLeft,
                        session.lives),
                28,
                78);

        g.setColor(new Color(0, 0, 0, 100));
        g.fillRoundRect(getWidth() - 210, 12, 194, 56, 14, 14);
        g.setColor(new Color(230, 235, 240));
        g.setFont(new Font("SansSerif", Font.PLAIN, 12));
        g.drawString("Arrows/WASD tilt", getWidth() - 196, 34);
        g.drawString("R restart · Esc menu", getWidth() - 196, 52);
    }

    private void paintOverlay(Graphics2D g) {
        if (session.status == GameSession.Status.PLAYING) {
            if (session.banner != null && !session.banner.isEmpty() && anim < 3.5) {
                g.setColor(new Color(0, 0, 0, 100));
                int bw = Math.min(getWidth() - 80, 520);
                g.fillRoundRect((getWidth() - bw) / 2, getHeight() - 90, bw, 44, 12, 12);
                g.setColor(Color.WHITE);
                g.setFont(new Font("SansSerif", Font.PLAIN, 15));
                int tw = g.getFontMetrics().stringWidth(session.banner);
                g.drawString(session.banner, (getWidth() - tw) / 2, getHeight() - 62);
            }
            if (session.goalOpen) {
                g.setColor(new Color(255, 230, 120));
                g.setFont(new Font("SansSerif", Font.BOLD, 14));
                g.drawString("Goal unlocked — roll onto the exit", 28, getHeight() - 24);
            }
            return;
        }

        g.setColor(new Color(10, 16, 28, 160));
        g.fillRect(0, 0, getWidth(), getHeight());
        g.setFont(new Font("Serif", Font.BOLD, 42));
        String msg =
                switch (session.status) {
                    case WON -> "Cleared!";
                    case FELL -> "Fell away!";
                    case TIME_UP -> "Time's up!";
                    default -> "";
                };
        g.setColor(Color.WHITE);
        int tw = g.getFontMetrics().stringWidth(msg);
        g.drawString(msg, (getWidth() - tw) / 2, getHeight() / 2 - 10);
        g.setFont(new Font("SansSerif", Font.PLAIN, 16));
        String hint =
                session.status == GameSession.Status.WON
                        ? "Enter / N — next level"
                        : (session.lives > 0 ? "Enter — try again" : "Enter — restart level");
        int hw = g.getFontMetrics().stringWidth(hint);
        g.drawString(hint, (getWidth() - hw) / 2, getHeight() / 2 + 28);
    }
}
