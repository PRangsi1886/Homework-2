package org.neverball.level;

import java.util.ArrayList;
import java.util.List;

/** One playable course loaded from a .nbl file. */
public final class Level {
    public String id = "untitled";
    public String name = "Untitled";
    public String message = "";
    public double timeLimit = 60;
    public int goalCoins = 1;
    public double spawnX;
    public double spawnZ;
    public final List<Platform> platforms = new ArrayList<>();
    public final List<Wall> walls = new ArrayList<>();
    public final List<Coin> coins = new ArrayList<>();
    public final List<Hazard> hazards = new ArrayList<>();
    public Goal goal = new Goal(0, 0, 1.2);

    public static final class Platform {
        public final double x;
        public final double z;
        public final double w;
        public final double d;

        public Platform(double x, double z, double w, double d) {
            this.x = x;
            this.z = z;
            this.w = w;
            this.d = d;
        }

        public boolean contains(double px, double pz, double margin) {
            return px >= x - margin && px <= x + w + margin
                    && pz >= z - margin && pz <= z + d + margin;
        }
    }

    public static final class Wall {
        public final double x;
        public final double z;
        public final double w;
        public final double d;

        public Wall(double x, double z, double w, double d) {
            this.x = x;
            this.z = z;
            this.w = w;
            this.d = d;
        }
    }

    public static final class Coin {
        public final double x;
        public final double z;
        public final int value;
        public boolean taken;

        public Coin(double x, double z, int value) {
            this.x = x;
            this.z = z;
            this.value = value;
        }

        public void reset() {
            taken = false;
        }
    }

    public static final class Hazard {
        public final double x;
        public final double z;
        public final double w;
        public final double d;

        public Hazard(double x, double z, double w, double d) {
            this.x = x;
            this.z = z;
            this.w = w;
            this.d = d;
        }

        public boolean contains(double px, double pz) {
            return px >= x && px <= x + w && pz >= z && pz <= z + d;
        }
    }

    public static final class Goal {
        public final double x;
        public final double z;
        public final double radius;

        public Goal(double x, double z, double radius) {
            this.x = x;
            this.z = z;
            this.radius = radius;
        }
    }

    public void resetCoins() {
        for (Coin c : coins) {
            c.reset();
        }
    }

    public boolean onSolidGround(double px, double pz, double ballRadius) {
        for (Hazard h : hazards) {
            if (h.contains(px, pz)) {
                return false;
            }
        }
        for (Platform p : platforms) {
            if (p.contains(px, pz, -ballRadius * 0.15)) {
                return true;
            }
        }
        return false;
    }

    public double[] bounds() {
        double minX = Double.POSITIVE_INFINITY;
        double minZ = Double.POSITIVE_INFINITY;
        double maxX = Double.NEGATIVE_INFINITY;
        double maxZ = Double.NEGATIVE_INFINITY;
        for (Platform p : platforms) {
            minX = Math.min(minX, p.x);
            minZ = Math.min(minZ, p.z);
            maxX = Math.max(maxX, p.x + p.w);
            maxZ = Math.max(maxZ, p.z + p.d);
        }
        if (!Double.isFinite(minX)) {
            return new double[] {-8, -8, 8, 8};
        }
        return new double[] {minX, minZ, maxX, maxZ};
    }
}
