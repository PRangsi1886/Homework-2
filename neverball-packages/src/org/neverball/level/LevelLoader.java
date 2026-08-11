package org.neverball.level;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;

/** Parses Neverball-Packages Java `.nbl` level files. */
public final class LevelLoader {
    private LevelLoader() {}

    public static Level load(Path path) throws IOException {
        Level level = new Level();
        String fileName = path.getFileName().toString();
        level.id = fileName.replaceFirst("\\.nbl$", "");
        try (BufferedReader br = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            String line;
            int lineNo = 0;
            while ((line = br.readLine()) != null) {
                lineNo++;
                line = stripComment(line).trim();
                if (line.isEmpty()) {
                    continue;
                }
                try {
                    parseLine(level, line);
                } catch (RuntimeException ex) {
                    throw new IOException("Bad line " + lineNo + " in " + path + ": " + line, ex);
                }
            }
        }
        if (level.platforms.isEmpty()) {
            throw new IOException("Level has no platforms: " + path);
        }
        return level;
    }

    private static String stripComment(String line) {
        int hash = line.indexOf('#');
        if (hash >= 0) {
            return line.substring(0, hash);
        }
        return line;
    }

    private static void parseLine(Level level, String line) {
        String lower = line.toLowerCase(Locale.ROOT);
        if (lower.startsWith("name:")) {
            level.name = line.substring(5).trim();
            return;
        }
        if (lower.startsWith("message:")) {
            level.message = line.substring(8).trim();
            return;
        }
        if (lower.startsWith("time:")) {
            level.timeLimit = Double.parseDouble(line.substring(5).trim());
            return;
        }
        if (lower.startsWith("goalcoins:") || lower.startsWith("goal:")) {
            int colon = line.indexOf(':');
            level.goalCoins = Integer.parseInt(line.substring(colon + 1).trim());
            return;
        }

        String[] parts = line.split("\\s+");
        String cmd = parts[0].toLowerCase(Locale.ROOT);
        switch (cmd) {
            case "platform" -> {
                require(parts, 5);
                level.platforms.add(new Level.Platform(
                        d(parts[1]), d(parts[2]), d(parts[3]), d(parts[4])));
            }
            case "wall" -> {
                require(parts, 5);
                level.walls.add(new Level.Wall(
                        d(parts[1]), d(parts[2]), d(parts[3]), d(parts[4])));
            }
            case "hazard" -> {
                require(parts, 5);
                level.hazards.add(new Level.Hazard(
                        d(parts[1]), d(parts[2]), d(parts[3]), d(parts[4])));
            }
            case "coin" -> {
                require(parts, 4);
                int value = (int) d(parts[3]);
                if (value != 1 && value != 5 && value != 10) {
                    value = 1;
                }
                level.coins.add(new Level.Coin(d(parts[1]), d(parts[2]), value));
            }
            case "spawn" -> {
                require(parts, 3);
                level.spawnX = d(parts[1]);
                level.spawnZ = d(parts[2]);
            }
            case "goal" -> {
                require(parts, 4);
                level.goal = new Level.Goal(d(parts[1]), d(parts[2]), d(parts[3]));
            }
            default -> throw new IllegalArgumentException("Unknown command: " + cmd);
        }
    }

    private static void require(String[] parts, int n) {
        if (parts.length < n) {
            throw new IllegalArgumentException("Expected " + n + " tokens");
        }
    }

    private static double d(String s) {
        return Double.parseDouble(s);
    }
}
