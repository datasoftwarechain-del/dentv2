"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Icon } from "@iconify/react"

const MENU_ITEMS = {
    status: [
        { value: "focus", icon: "solar:emoji-funny-circle-line-duotone", label: "Focus" },
        { value: "offline", icon: "solar:moon-sleep-line-duotone", label: "Appear Offline" },
    ],
    profile: [
        { icon: "solar:user-circle-line-duotone", label: "Your profile", action: "profile" },
        { icon: "solar:sun-line-duotone", label: "Appearance", action: "appearance" },
        { icon: "solar:settings-line-duotone", label: "Settings", action: "settings" },
        { icon: "solar:bell-line-duotone", label: "Notifications", action: "notifications" },
    ],
    premium: [
        {
            icon: "solar:star-bold",
            label: "Upgrade to Pro",
            action: "upgrade",
            iconClass: "text-amber-500",
            badge: { text: "20% off", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 border-amber-200 dark:border-amber-800" },
        },
        { icon: "solar:gift-line-duotone", label: "Referrals", action: "referrals" },
    ],
    support: [
        { icon: "solar:download-line-duotone", label: "Download app", action: "download" },
        {
            icon: "solar:letter-unread-line-duotone",
            label: "What's new?",
            action: "whats-new",
            rightIcon: "solar:square-top-down-line-duotone",
        },
        {
            icon: "solar:question-circle-line-duotone",
            label: "Get help?",
            action: "help",
            rightIcon: "solar:square-top-down-line-duotone",
        },
    ],
    account: [
        {
            icon: "solar:users-group-rounded-bold-duotone",
            label: "Switch account",
            action: "switch",
            showAvatar: false,
        },
        { icon: "solar:logout-2-bold-duotone", label: "Log out", action: "logout" },
    ],
}

interface UserDropdownProps {
    user?: {
        name: string
        username: string
        avatar: string
        initials: string
        status: string
    }
    onAction?: (action: string) => void
    onStatusChange?: (status: string) => void
    selectedStatus?: string
    promoDiscount?: string
    accounts?: any[]
}

export const UserDropdown = ({
    user = {
        name: "Ayman Echakar",
        username: "@aymanch-03",
        avatar: "https://avatars.githubusercontent.com/u/126724835?v=4",
        initials: "AE",
        status: "online",
    },
    onAction = () => { },
    onStatusChange = () => { },
    selectedStatus = "online",
    promoDiscount = "20% off",
    accounts = [],
}: UserDropdownProps) => {
    const renderMenuItem = (item: any, index: number) => (
        <DropdownMenuItem
            key={index}
            className={cn(
                "cursor-pointer",
                item.badge || item.showAvatar || item.rightIcon ? "justify-between" : ""
            )}
            onClick={() => onAction(item.action)}
        >
            <span className="flex items-center gap-2">
                <Icon
                    icon={item.icon}
                    className={cn("size-5 text-muted-foreground", item.iconClass)}
                />
                {item.label}
            </span>
            {item.badge && (
                <Badge
                    variant="secondary"
                    className={cn("text-[10px] px-1.5 h-5", item.badge.className)}
                >
                    {promoDiscount || item.badge.text}
                </Badge>
            )}
            {item.rightIcon && (
                <Icon
                    icon={item.rightIcon}
                    className="size-4 text-muted-foreground"
                />
            )}
            {item.showAvatar && (
                <Avatar className="size-5 border border-border">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="text-[10px]">{user.initials}</AvatarFallback>
                </Avatar>
            )}
        </DropdownMenuItem>
    )

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            online: "bg-green-500/15 text-green-700 border-green-200 dark:text-green-400 dark:border-green-800",
            offline: "bg-muted text-muted-foreground border-border",
            busy: "bg-destructive/15 text-destructive border-destructive/20",
        }
        return colors[status.toLowerCase()] || colors.online
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="rounded-full ring-offset-background transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                    <Avatar className="size-10 border border-border">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback>{user.initials}</AvatarFallback>
                    </Avatar>
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-[300px] p-2" align="end">
                <div className="flex items-center gap-3 p-2">
                    <div className="relative">
                        <Avatar className="size-10 border border-border">
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback>{user.initials}</AvatarFallback>
                        </Avatar>
                        <span className={cn(
                            "absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background",
                            user.status === "online" ? "bg-green-500" :
                                user.status === "busy" ? "bg-destructive" : "bg-zinc-400"
                        )} />
                    </div>
                    <div className="flex flex-1 flex-col space-y-0.5">
                        <p className="text-sm font-semibold text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.username}</p>
                    </div>
                    <Badge
                        variant="outline"
                        className={cn("capitalize", getStatusColor(user.status))}
                    >
                        {user.status}
                    </Badge>
                </div>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="cursor-pointer">
                            <Icon
                                icon="solar:smile-circle-line-duotone"
                                className="mr-2 size-5 text-muted-foreground"
                            />
                            <span>Update status</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                                <DropdownMenuRadioGroup
                                    value={selectedStatus}
                                    onValueChange={onStatusChange}
                                >
                                    {MENU_ITEMS.status.map((status: any, index: number) => (
                                        <DropdownMenuRadioItem
                                            className="cursor-pointer"
                                            key={index}
                                            value={status.value}
                                        >
                                            <Icon
                                                icon={status.icon}
                                                className="mr-2 size-4 text-muted-foreground"
                                            />
                                            {status.label}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                    </DropdownMenuSub>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                    {MENU_ITEMS.profile.map(renderMenuItem)}
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                    {MENU_ITEMS.premium.map(renderMenuItem)}
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                    {MENU_ITEMS.support.map(renderMenuItem)}
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                    {MENU_ITEMS.account.map(renderMenuItem)}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default UserDropdown
