package org.neverball.game;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import javax.swing.JFrame;
import javax.swing.SwingUtilities;
import javax.swing.WindowConstants;

import org.neverball.level.PackageSet;
import org.neverball.ui.GamePanel;

public final class Main {
    public static void main(String[] args) throws Exception {
        Path packagesRoot = resolvePackagesRoot(args);
        if (!Files.isDirectory(packagesRoot)) {
            System.err.println("Packages directory not found: " + packagesRoot.toAbsolutePath());
            System.err.println("Run from neverball-packages/ or pass the packages path.");
            System.exit(1);
        }
        List<PackageSet> sets = PackageSet.discover(packagesRoot);
        if (sets.isEmpty()) {
            System.err.println("No set-* packs found in " + packagesRoot.toAbsolutePath());
            System.exit(1);
        }
        System.out.println("Loaded " + sets.size() + " package set(s) from " + packagesRoot.toAbsolutePath());
        for (PackageSet set : sets) {
            System.out.println("  - " + set.title + " [" + set.mapFiles.size() + " maps]");
        }

        SwingUtilities.invokeLater(() -> {
            JFrame frame = new JFrame("Neverball Packages — Java");
            frame.setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);
            frame.setContentPane(new GamePanel(packagesRoot, sets));
            frame.pack();
            frame.setLocationRelativeTo(null);
            frame.setVisible(true);
        });
    }

    static Path resolvePackagesRoot(String[] args) {
        if (args.length > 0) {
            return Path.of(args[0]);
        }
        Path cwd = Path.of("").toAbsolutePath().normalize();
        Path direct = cwd.resolve("packages");
        if (Files.isDirectory(direct)) {
            return direct;
        }
        Path nested = cwd.resolve("neverball-packages/packages");
        if (Files.isDirectory(nested)) {
            return nested;
        }
        // when cwd is repo root and user runs from bin context
        Path sibling = cwd.resolve("../packages").normalize();
        if (Files.isDirectory(sibling)) {
            return sibling;
        }
        return direct;
    }
}
