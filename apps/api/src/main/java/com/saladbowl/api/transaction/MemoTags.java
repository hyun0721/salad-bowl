package com.saladbowl.api.transaction;

import java.text.Normalizer;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

public final class MemoTags {
    private static final Pattern TAG = Pattern.compile("(?<!\\S)#([\\p{L}\\p{N}_]{1,50})(?![\\p{L}\\p{N}_])");
    private static final Pattern NAME = Pattern.compile("[\\p{L}\\p{N}_]{1,50}");

    private MemoTags() {}

    public static String normalizeTag(String raw) {
        if (raw == null) throw new IllegalArgumentException("invalid tag");
        String tag = Normalizer.normalize(raw.startsWith("#") ? raw.substring(1) : raw, Normalizer.Form.NFC);
        if (!NAME.matcher(tag).matches()) throw new IllegalArgumentException("invalid tag: " + raw);
        return tag;
    }

    public static List<String> extract(String memo) {
        if (memo == null) return List.of();
        Set<String> tags = new LinkedHashSet<>();
        var matcher = TAG.matcher(Normalizer.normalize(memo, Normalizer.Form.NFC));
        while (matcher.find()) tags.add(matcher.group(1));
        return List.copyOf(tags);
    }

    public static String add(String memo, Collection<String> tags) {
        String result = memo == null ? "" : memo;
        Set<String> present = new LinkedHashSet<>(extract(result));
        for (String raw : tags) {
            String tag = normalizeTag(raw);
            if (present.add(tag)) result += (result.isEmpty() ? "" : " ") + "#" + tag;
        }
        return result;
    }

    public static String remove(String memo, Collection<String> tags) {
        String original = memo == null ? "" : memo;
        Set<String> removed = new LinkedHashSet<>();
        for (String raw : tags) removed.add(normalizeTag(raw));
        String normalized = Normalizer.normalize(original, Normalizer.Form.NFC);
        var matcher = TAG.matcher(normalized);
        StringBuilder result = new StringBuilder();
        int from = 0;
        boolean changed = false;
        while (matcher.find()) {
            if (!removed.contains(matcher.group(1))) continue;
            result.append(normalized, from, matcher.start());
            int end = matcher.end();
            if (!result.isEmpty() && result.charAt(result.length() - 1) == ' ') {
                result.deleteCharAt(result.length() - 1);
            } else if (result.isEmpty() && end < normalized.length() && normalized.charAt(end) == ' ') {
                end++;
            }
            from = end;
            changed = true;
        }
        return changed ? result.append(normalized, from, normalized.length()).toString() : original;
    }
}
