import discovery from "../domain/discovery.js";
import "./DishArt.css";
const COLORS = {
  chicken: ["#f6e9d4", "#bf7845", "#e4aa67"],
  pork: ["#f4e0d8", "#9e583e", "#cf8968"],
  beef: ["#e9e5da", "#795044", "#a97958"],
  seafood: ["#e0eced", "#6c9690", "#b2c5b9"],
  vegetables: ["#e8eddd", "#71934e", "#b2bd76"],
  merienda: ["#f0e3ec", "#b887a6", "#d6b4c7"],
};
export default function DishArt({ recipe, variant, className = "" }) {
  const kind = variant || discovery.discoveryMetadata(recipe).art;
  const [background, dark, light] = COLORS[kind] || COLORS.vegetables;
  return (
    <div
      className={`dish-art dish-art-${kind} ${className}`}
      style={{ "--dish-background": background }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 400 240" fill="none" focusable="false">
        <ellipse cx="202" cy="197" rx="112" ry="13" fill="#253f3210" />
        <path
          d="M64 38L112 11M57 52L105 25M50 66L98 39"
          stroke="#ffffff75"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <circle cx="325" cy="183" r="16" fill={light} opacity=".35" />
        <circle cx="338" cy="66" r="6" fill={dark} opacity=".35" />
        <ellipse cx="200" cy="127" rx="125" ry="82" fill="#faf9f2" />
        <ellipse
          cx="200"
          cy="127"
          rx="111"
          ry="69"
          stroke="#dedbcc"
          strokeWidth="2"
        />
        <ellipse
          cx="200"
          cy="127"
          rx="99"
          ry="59"
          fill={kind === "merienda" ? "#eee3d1" : "#bd885b"}
          opacity={kind === "vegetables" ? ".45" : ".8"}
        />
        {kind === "seafood" ? (
          <>
            <path
              d="M131 130C166 89 228 88 267 128C224 168 165 167 131 130Z"
              fill={light}
            />
            <path d="M260 127L289 102L284 149Z" fill={dark} />
            <path
              d="M178 107L173 151M199 102L194 157M221 108L215 151"
              stroke={dark}
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx="152" cy="127" r="4" fill="#29433a" />
          </>
        ) : kind === "merienda" ? (
          <>
            <path d="M144 112L200 86L253 117L200 146Z" fill={light} />
            <path d="M144 112V151L200 176V146Z" fill={dark} />
            <path d="M200 146L253 117V153L200 176Z" fill="#cba4bd" />
            <path
              d="M148 132L200 157L249 131"
              stroke="#f8f1df"
              strokeWidth="8"
            />
            <ellipse cx="201" cy="107" rx="13" ry="7" fill="#fbf4e6" />
          </>
        ) : (
          <>
            <path
              d="M134 111C129 97 148 89 164 96L181 110C191 128 173 139 157 133Z"
              fill={dark}
            />
            <path
              d="M198 93C213 85 236 94 244 109L237 126C222 140 201 124 196 109Z"
              fill={light}
            />
            <path
              d="M177 144C183 128 211 128 222 145L216 169C198 180 174 161 177 144Z"
              fill={dark}
            />
            <path d="M125 148L147 134L166 151L152 167Z" fill={light} />
            <path d="M240 144L262 129L274 147L253 162Z" fill={dark} />
            <path
              d="M141 108L157 116M207 103L223 114M188 148L204 157"
              stroke="#ffffff40"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </>
        )}
        <path
          d="M178 90C166 73 145 81 154 94C161 104 178 102 178 90Z"
          fill="#608553"
        />
        <path
          d="M249 143C258 125 277 132 269 147C260 157 246 155 249 143Z"
          fill="#477249"
        />
        <path
          d="M158 158C147 171 132 167 136 154C141 143 157 147 158 158Z"
          fill="#81a15f"
        />
        {kind !== "merienda" && (
          <>
            <path
              d="M175 109L229 147M157 136L222 116"
              stroke="#d3d89d"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <ellipse
              cx="243"
              cy="101"
              rx="12"
              ry="8"
              transform="rotate(30 243 101)"
              fill="#da7857"
            />
            <circle cx="174" cy="131" r="3" fill="#333b2c" />
            <circle cx="220" cy="156" r="2" fill="#333b2c" />
          </>
        )}
        <path
          d="M317 100L299 161"
          stroke="#ac9071"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M329 105L310 167"
          stroke="#ac9071"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
