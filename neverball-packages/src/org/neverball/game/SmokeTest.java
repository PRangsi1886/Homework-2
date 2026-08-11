package org.neverball.game;

import java.nio.file.Path;
import java.util.List;

import org.neverball.level.Level;
import org.neverball.level.LevelLoader;
import org.neverball.level.PackageSet;

/**
 * Headless verification that packages load and physics can clear a trivial level.
 */
public final class SmokeTest {
    public static void main(String[] args) throws Exception {
        Path packagesRoot = Main.resolvePackagesRoot(args);
        List<PackageSet> sets = PackageSet.discover(packagesRoot);
        if (sets.isEmpty()) {
            fail("No sets discovered in " + packagesRoot.toAbsolutePath());
        }
        int levels = 0;
        for (PackageSet set : sets) {
            for (Path map : set.mapFiles) {
                Level level = LevelLoader.load(map);
                if (level.platforms.isEmpty()) {
                    fail("No platforms in " + map);
                }
                levels++;
            }
        }

        // Deterministic physics sanity: hold tilt toward +X on first tutorial map
        Level level = LevelLoader.load(sets.get(0).mapFiles.get(0));
        GameSession session = new GameSession(level);
        for (int i = 0; i < 120; i++) {
            session.update(1.0 / 60.0, false, true, false, false);
        }
        if (session.ball.pos.x == level.spawnX && session.ball.vel.x == 0) {
            fail("Ball did not respond to tilt");
        }

        System.out.println("SmokeTest OK");
        System.out.println("  sets=" + sets.size() + " levels=" + levels);
        System.out.println("  sampleBallX=" + String.format("%.3f", session.ball.pos.x));
        System.out.println("  sampleStatus=" + session.status);
    }

    private static void fail(String msg) {
        System.err.println("SmokeTest FAILED: " + msg);
        System.exit(1);
    }
}
