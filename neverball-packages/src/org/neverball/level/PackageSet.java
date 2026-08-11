package org.neverball.level;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Loads addon sets from a packages root, similar to Neverball/packages set-* folders.
 */
public final class PackageSet {
    public final String folderName;
    public final String title;
    public final String difficulty;
    public final String author;
    public final String description;
    public final List<Path> mapFiles;

    public PackageSet(
            String folderName,
            String title,
            String difficulty,
            String author,
            String description,
            List<Path> mapFiles) {
        this.folderName = folderName;
        this.title = title;
        this.difficulty = difficulty;
        this.author = author;
        this.description = description;
        this.mapFiles = List.copyOf(mapFiles);
    }

    public static List<PackageSet> discover(Path packagesRoot) throws IOException {
        List<PackageSet> sets = new ArrayList<>();
        if (!Files.isDirectory(packagesRoot)) {
            return sets;
        }
        try (DirectoryStream<Path> dirs = Files.newDirectoryStream(packagesRoot)) {
            for (Path dir : dirs) {
                if (!Files.isDirectory(dir)) {
                    continue;
                }
                String name = dir.getFileName().toString();
                if (!name.startsWith("set-")) {
                    continue;
                }
                PackageSet set = loadSet(dir);
                if (!set.mapFiles.isEmpty()) {
                    sets.add(set);
                }
            }
        }
        sets.sort(Comparator
                .comparing((PackageSet s) -> s.folderName.contains("tutorial") ? 0 : 1)
                .thenComparing(s -> s.folderName));
        return sets;
    }

    private static PackageSet loadSet(Path setDir) throws IOException {
        String folder = setDir.getFileName().toString();
        Path meta = setDir.resolve(folder + ".txt");
        String title = folder;
        String difficulty = "";
        String author = "";
        String description = "";
        List<String> ordered = new ArrayList<>();

        if (Files.isRegularFile(meta)) {
            try (BufferedReader br = Files.newBufferedReader(meta, StandardCharsets.UTF_8)) {
                String line;
                boolean first = true;
                while ((line = br.readLine()) != null) {
                    line = line.trim();
                    if (line.isEmpty() || line.startsWith("#")) {
                        continue;
                    }
                    if (first) {
                        title = line;
                        first = false;
                        continue;
                    }
                    String lower = line.toLowerCase();
                    if (lower.startsWith("difficulty:")) {
                        difficulty = line.substring(line.indexOf(':') + 1).trim();
                    } else if (lower.startsWith("author:")) {
                        author = line.substring(line.indexOf(':') + 1).trim();
                    } else if (lower.startsWith("description:")) {
                        description = line.substring(line.indexOf(':') + 1).trim();
                    } else if (!line.contains(":") && !line.contains("/")) {
                        // bare map id
                        ordered.add(line.endsWith(".nbl") ? line : line + ".nbl");
                    } else if (line.endsWith(".nbl") || line.contains("maps/")) {
                        int slash = line.lastIndexOf('/');
                        ordered.add(slash >= 0 ? line.substring(slash + 1) : line);
                    }
                }
            }
        }

        Path mapsDir = setDir.resolve("maps");
        List<Path> maps = new ArrayList<>();
        if (!ordered.isEmpty() && Files.isDirectory(mapsDir)) {
            for (String name : ordered) {
                Path p = mapsDir.resolve(name);
                if (Files.isRegularFile(p)) {
                    maps.add(p);
                }
            }
        }
        if (maps.isEmpty() && Files.isDirectory(mapsDir)) {
            try (DirectoryStream<Path> stream = Files.newDirectoryStream(mapsDir, "*.nbl")) {
                for (Path p : stream) {
                    maps.add(p);
                }
            }
            maps.sort(Comparator.comparing(p -> p.getFileName().toString()));
        }
        return new PackageSet(folder, title, difficulty, author, description, maps);
    }
}
