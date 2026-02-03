"use client";

import UserDropdown from "@/components/ui/user-dropdown";

export default function UserDropdownDemo() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-8 gap-8">
            <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Dropdown Component</h1>
                <p className="text-gray-500 dark:text-gray-400">Click the avatar below to see the dropdown menu</p>
            </div>

            <div className="p-8 border rounded-xl bg-white dark:bg-gray-800 shadow-sm">
                <UserDropdown
                    onAction={(action) => console.log(`Action triggered: ${action}`)}
                    onStatusChange={(status) => console.log(`Status changed: ${status}`)}
                />
            </div>
        </div>
    );
}
