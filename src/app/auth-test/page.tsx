import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export default async function AuthTestPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Authentication Test</h1>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Current User</h2>
          <dl className="space-y-2">
            <div>
              <dt className="font-medium text-gray-600">ID:</dt>
              <dd className="text-gray-900">{user.id}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-600">Email:</dt>
              <dd className="text-gray-900">{user.email}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-600">Role:</dt>
              <dd className="text-gray-900">{user.role}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-600">Created:</dt>
              <dd className="text-gray-900">{user.createdAt.toLocaleString()}</dd>
            </div>
          </dl>
          <form action="/api/auth/logout" method="POST" className="mt-6">
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
            >
              Logout
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
