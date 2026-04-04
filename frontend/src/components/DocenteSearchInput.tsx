/**
 * DocenteSearchInput
 *
 * Campo de búsqueda de docentes activos con debounce y dropdown de resultados.
 * Llama a GET /users/search-docentes?q=<query> (mínimo 2 caracteres).
 *
 * Props:
 *   value        — id del docente seleccionado (string vacío = sin selección)
 *   onChange     — callback cuando cambia la selección
 *   excludeIds   — ids a excluir de los resultados (ej: el otro director ya elegido)
 *   label        — etiqueta del campo
 *   required     — si el campo es obligatorio
 *   placeholder  — placeholder del input (opcional)
 *   optional     — texto "(opcional)" junto al label
 */

import { useEffect, useRef, useState } from "react";
import api from "../services/api";

interface DocenteResult {
  id: string;
  full_name: string;
  email: string;
}

interface Props {
  value: string;
  onChange: (id: string, docente: DocenteResult | null) => void;
  excludeIds?: string[];
  label: string;
  required?: boolean;
  optional?: boolean;
  placeholder?: string;
  suggested?: { id: string; full_name: string };
  changedWarning?: boolean;
}

export default function DocenteSearchInput({
  value,
  onChange,
  excludeIds = [],
  label,
  required = false,
  optional = false,
  placeholder = "Buscar docente por nombre o email…",
  suggested,
  changedWarning = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DocenteResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DocenteResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounce de búsqueda
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get<DocenteResult[]>("/users/search-docentes", {
          params: { q: query.trim() },
        });
        setResults(data.filter((d) => !excludeIds.includes(d.id)));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  // excludeIds cambia referencia en cada render — comparar por contenido no por referencia
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function handleSelect(docente: DocenteResult) {
    setSelected(docente);
    setQuery("");
    setResults([]);
    setOpen(false);
    onChange(docente.id, docente);
  }

  function handleClear() {
    setSelected(null);
    setQuery("");
    onChange("", null);
  }

  return (
    <div ref={containerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{" "}
        {required && <span className="text-red-500">*</span>}
        {optional && <span className="text-gray-400 font-normal">(opcional)</span>}
      </label>

      {suggested && (
        <p className="text-xs text-blue-600 mb-1">
          Sugerido: <strong>{suggested.full_name}</strong>
        </p>
      )}

      {/* Docente seleccionado — chip */}
      {value && selected ? (
        <div className="flex items-center justify-between border border-usc-blue bg-blue-50 rounded-lg px-3 py-2 text-sm">
          <span className="font-medium text-usc-navy">{selected.full_name}</span>
          <button
            type="button"
            onClick={handleClear}
            className="ml-3 text-gray-400 hover:text-red-500 transition-colors text-xs font-bold"
            aria-label="Quitar selección"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
          />
          {searching && (
            <span className="absolute right-3 top-2.5 text-xs text-gray-400">
              Buscando…
            </span>
          )}

          {open && results.length > 0 && (
            <ul className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
              {results.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()} // evita que onBlur cierre antes del click
                    onClick={() => handleSelect(d)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm"
                  >
                    <span className="font-medium text-gray-800">{d.full_name}</span>
                    <span className="text-gray-400 ml-2 text-xs">{d.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!searching && query.trim().length >= 2 && open && results.length === 0 && (
            <p className="mt-1 text-xs text-gray-400">
              No se encontraron docentes activos con ese criterio.
            </p>
          )}
        </div>
      )}

      {changedWarning && (
        <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 mt-1">
          Se registrará el cambio respecto al jurado del anteproyecto para trazabilidad.
        </p>
      )}
    </div>
  );
}
