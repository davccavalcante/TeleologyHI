/**
 * Guards a terse assistant answer against CommonMark's ordered-list parsing.
 *
 * The governed HIM persona (cogni.economy) answers tersely, so a numeric
 * answer arrives as a bare "391." on a single line. `remark-gfm` parses a
 * leading `<digits>.` (or `<digits>)`) as an ordered-list marker; with no
 * content after the marker the AST becomes an empty ordered-list item, which
 * the renderer then shows as "1.", hiding the real number. That is Arena
 * finding F-COLD-3: the governed column displayed "1." for every numeric
 * answer while the persisted store held the correct value ("391.").
 *
 * A genuine ordered list spans multiple lines ("1. a\n2. b"), so the marker
 * is escaped only when the whole answer is a single line. Real multi-line
 * lists are left untouched, and the escaped delimiter renders as the literal
 * character, so the number is shown exactly as the entity wrote it.
 *
 *   guardTerseOrderedMarker("391.")        -> "391\\."   (paragraph "391.")
 *   guardTerseOrderedMarker("5) see note") -> "5\\) see note"
 *   guardTerseOrderedMarker("1. a\n2. b")  -> "1. a\n2. b" (unchanged list)
 *   guardTerseOrderedMarker("**Six**.")    -> "**Six**."  (unchanged)
 */
export function guardTerseOrderedMarker(content: string): string {
  if (content.includes("\n")) {
    return content;
  }
  return content.replace(/^(\s*\d+)([.)])/, "$1\\$2");
}
