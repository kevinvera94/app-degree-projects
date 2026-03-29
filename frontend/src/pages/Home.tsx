export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow p-8 max-w-md w-full text-center">
        <div className="w-12 h-12 bg-usc-navy rounded-full mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-usc-navy mb-2">
          USC — Trabajos de Grado
        </h1>
        <p className="text-gray-500">
          Sistema de gestión de trabajos de grado de la Universidad Santiago de
          Cali.
        </p>
        <div className="mt-6 flex gap-2 justify-center">
          <span className="px-3 py-1 rounded-full text-sm bg-usc-blue text-white">
            Frontend listo
          </span>
          <span className="px-3 py-1 rounded-full text-sm bg-usc-gold text-white">
            USC
          </span>
        </div>
      </div>
    </div>
  );
}
