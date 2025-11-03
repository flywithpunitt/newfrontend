// App.jsx
import { Lock } from "lucide-react";
import { motion } from "framer-motion";

export default function App() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-gray-50 text-gray-800">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-md"
      >
        <div className="flex justify-center mb-4">
          <Lock className="h-16 w-16 text-red-500" />
        </div>
        <h1 className="text-3xl font-semibold mb-2">
          Subscription Expired
        </h1>
        <p className="text-gray-600 mb-6">
          Your free 3-month trial has ended. To continue using this website,
          please renew or purchase a subscription plan.
        </p>
        <div className="text-sm text-gray-400 mt-8">
          © {new Date().getFullYear()} Vercel. All rights reserved.
        </div>
      </motion.div>
    </div>
  );
}
