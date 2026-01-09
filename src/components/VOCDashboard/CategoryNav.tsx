import { cn } from "@/lib/utils";
import { Database, BookOpen, Settings, Shield, LogOut, LucideIcon, HelpCircle, ChevronDown, Ticket, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import predictoLogo from "@/assets/predicto-logo.svg";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { subCategories } from "./SubCategoryTabs";
import { ticketSubCategories } from "./TicketSubCategories";
import { knowledgeBaseSubCategories } from "./KnowledgeBaseSubCategories";

export interface MainSection {
  key: string;
  name: string;
  icon: LucideIcon;
  children?: MainSection[];
}

export const mainSections: MainSection[] = [
  { key: "inputData", name: "Input Persona AI", icon: Database },
  { key: "knowledgeBase", name: "Knowledge Base", icon: BookOpen },
  { key: "ticket", name: "Ticket", icon: Ticket },
  { key: "adminRole", name: "Admin Role", icon: Shield },
];

interface CategoryNavProps {
  activeSection: string;
  onSectionChange: (key: string) => void;
  activeCategory: string;
  onCategoryChange: (key: string) => void;
  activeTicketCategory: string;
  onTicketCategoryChange: (key: string) => void;
  activeKnowledgeCategory: string;
  onKnowledgeCategoryChange: (key: string) => void;
}

export function CategoryNav({ activeSection, onSectionChange, activeCategory, onCategoryChange, activeTicketCategory, onTicketCategoryChange, activeKnowledgeCategory, onKnowledgeCategoryChange }: CategoryNavProps) {
  const navigate = useNavigate();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleLogout = () => {
    navigate("/");
  };

  const handleAccountClick = () => {
    onSectionChange("account");
  };

  const handleSubCategoryClick = (key: string) => {
    onSectionChange("inputData");
    onCategoryChange(key);
    // Note: viewMode reset should be handled in Dashboard when category changes
  };

  const handleTicketSubCategoryClick = (key: string) => {
    onSectionChange("ticket");
    onTicketCategoryChange(key);
  };

  const handleKnowledgeSubCategoryClick = (key: string) => {
    onSectionChange("knowledgeBase");
    onKnowledgeCategoryChange(key);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className={cn(
        "h-[57px] flex items-center border-b border-border transition-all",
        isCollapsed ? "justify-center px-0" : "justify-center px-3"
      )}>
        <div className="flex items-center justify-center">
          <img
            src={predictoLogo}
            alt="Predicto"
            className={cn(
              "object-contain transition-all duration-300",
              isCollapsed ? "h-6 w-6" : "h-5 w-auto"
            )}
          />
        </div>
      </SidebarHeader>

      <SidebarContent className={cn("transition-all", isCollapsed ? "px-0" : "px-3")}>
        <SidebarGroup className={cn(isCollapsed && "p-0 py-2")}>
          <SidebarGroupLabel className={cn(
            "text-xs text-button-hover uppercase tracking-wide mb-3 transition-all",
            isCollapsed ? "px-0 text-center" : "px-3"
          )}>{isCollapsed ? "" : "Main"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainSections.map((section) => {
                const isActive = activeSection === section.key;
                const Icon = section.icon;

                if (section.key === "inputData") {
                  return (
                    <Collapsible
                      key={section.key}
                      defaultOpen={activeSection === "inputData"}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            isActive={isActive}
                            tooltip={section.name}
                            className="w-full"
                            onClick={() => onSectionChange("inputData")}
                          >
                            <Icon className={cn(
                              "h-5 w-5 shrink-0 transition-colors",
                              isActive ? "text-button-hover-foreground" : "text-foreground/70 group-hover/menu-button:text-button-hover-foreground"
                            )} />
                            <span className={cn(
                              "text-sm transition-colors",
                              isActive ? "text-button-hover-foreground" : "group-hover/menu-button:text-button-hover-foreground"
                            )}>{section.name}</span>
                            <ChevronDown className={cn(
                              "ml-auto h-5 w-5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180 transition-colors",
                              isActive ? "text-button-hover-foreground" : "group-hover/menu-button:text-button-hover-foreground"
                            )} />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub className="space-y-1.5 mt-2">
                            {subCategories.map((subCat) => {
                              const SubIcon = subCat.icon;
                              const isSubActive = activeSection === "inputData" && activeCategory === subCat.key;

                              return (
                                <SidebarMenuSubItem key={subCat.key}>
                                  <SidebarMenuSubButton
                                    onClick={() => handleSubCategoryClick(subCat.key)}
                                    className="py-2 transition-colors duration-200 !bg-transparent hover:!bg-transparent data-[active=true]:!bg-transparent"
                                    data-active={isSubActive}
                                  >
                                    <SubIcon className={cn(
                                      "h-5 w-5 shrink-0 transition-colors",
                                      isSubActive
                                        ? "text-button-hover"
                                        : "text-foreground/60 hover:text-button-hover"
                                    )} />
                                    <span className={cn(
                                      "text-sm transition-colors",
                                      isSubActive
                                        ? "text-button-hover font-bold"
                                        : "text-foreground/80 hover:text-button-hover"
                                    )}>{subCat.name}</span>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                if (section.key === "knowledgeBase") {
                  return (
                    <Collapsible
                      key={section.key}
                      defaultOpen={activeSection === "knowledgeBase"}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            isActive={isActive}
                            tooltip={section.name}
                            className="w-full"
                            onClick={() => onSectionChange("knowledgeBase")}
                          >
                            <Icon className={cn(
                              "h-5 w-5 shrink-0 transition-colors",
                              isActive ? "text-button-hover-foreground" : "text-foreground/70 group-hover/menu-button:text-button-hover-foreground"
                            )} />
                            <span className={cn(
                              "text-sm transition-colors",
                              isActive ? "text-button-hover-foreground" : "group-hover/menu-button:text-button-hover-foreground"
                            )}>{section.name}</span>
                            <ChevronDown className={cn(
                              "ml-auto h-5 w-5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180 transition-colors",
                              isActive ? "text-button-hover-foreground" : "group-hover/menu-button:text-button-hover-foreground"
                            )} />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub className="space-y-1.5 mt-2">
                            {knowledgeBaseSubCategories.map((subCat) => {
                              const SubIcon = subCat.icon;
                              const isSubActive = activeSection === "knowledgeBase" && activeKnowledgeCategory === subCat.key;

                              return (
                                <SidebarMenuSubItem key={subCat.key}>
                                  <SidebarMenuSubButton
                                    onClick={() => handleKnowledgeSubCategoryClick(subCat.key)}
                                    className="py-2 transition-colors duration-200 !bg-transparent hover:!bg-transparent data-[active=true]:!bg-transparent"
                                    data-active={isSubActive}
                                  >
                                    <SubIcon className={cn(
                                      "h-5 w-5 shrink-0 transition-colors",
                                      isSubActive
                                        ? "text-button-hover"
                                        : "text-foreground/60 hover:text-button-hover"
                                    )} />
                                    <span className={cn(
                                      "text-sm transition-colors",
                                      isSubActive
                                        ? "text-button-hover font-bold"
                                        : "text-foreground/80 hover:text-button-hover"
                                    )}>{subCat.name}</span>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                if (section.key === "ticket") {
                  return (
                    <Collapsible
                      key={section.key}
                      defaultOpen={activeSection === "ticket"}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            isActive={isActive}
                            tooltip={section.name}
                            className="w-full"
                            onClick={() => onSectionChange("ticket")}
                          >
                            <Icon className={cn(
                              "h-5 w-5 shrink-0 transition-colors",
                              isActive ? "text-button-hover-foreground" : "text-foreground/70 group-hover/menu-button:text-button-hover-foreground"
                            )} />
                            <span className={cn(
                              "text-sm transition-colors",
                              isActive ? "text-button-hover-foreground" : "group-hover/menu-button:text-button-hover-foreground"
                            )}>{section.name}</span>
                            <ChevronDown className={cn(
                              "ml-auto h-5 w-5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180 transition-colors",
                              isActive ? "text-button-hover-foreground" : "group-hover/menu-button:text-button-hover-foreground"
                            )} />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub className="space-y-1.5 mt-2">
                            {ticketSubCategories.map((ticketCat) => {
                              const TicketIcon = ticketCat.icon;
                              const isTicketActive = activeSection === "ticket" && activeTicketCategory === ticketCat.key;

                              return (
                                <SidebarMenuSubItem key={ticketCat.key}>
                                  <SidebarMenuSubButton
                                    onClick={() => handleTicketSubCategoryClick(ticketCat.key)}
                                    className="py-2 transition-colors duration-200 !bg-transparent hover:!bg-transparent data-[active=true]:!bg-transparent"
                                    data-active={isTicketActive}
                                  >
                                    <TicketIcon className={cn(
                                      "h-5 w-5 shrink-0 transition-colors",
                                      isTicketActive
                                        ? "text-button-hover"
                                        : "text-foreground/60 hover:text-button-hover"
                                    )} />
                                    <span className={cn(
                                      "text-sm transition-colors",
                                      isTicketActive
                                        ? "text-button-hover font-bold"
                                        : "text-foreground/80 hover:text-button-hover"
                                    )}>{ticketCat.name}</span>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                return (
                  <SidebarMenuItem key={section.key}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => onSectionChange(section.key)}
                      tooltip={section.name}
                      className="w-full"
                    >
                      <Icon className={cn(
                        "h-5 w-5 shrink-0 transition-colors",
                        isActive ? "text-button-hover-foreground" : "text-foreground/70 group-hover/menu-button:text-button-hover-foreground"
                      )} />
                      <span className={cn(
                        "text-sm transition-colors",
                        isActive ? "text-button-hover-foreground" : "group-hover/menu-button:text-button-hover-foreground"
                      )}>{section.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        <SidebarGroup className={cn(isCollapsed && "p-0 py-2")}>
          <SidebarGroupLabel className={cn(
            "text-xs text-button-hover uppercase tracking-wide mb-3 transition-all",
            isCollapsed ? "px-0 text-center" : "px-3"
          )}>{isCollapsed ? "" : "Chat"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeSection === "liveChat"}
                  onClick={() => onSectionChange("liveChat")}
                  tooltip="Live Chat"
                >
                  <MessageCircle className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    activeSection === "liveChat" ? "text-button-hover-foreground" : "text-foreground/70 group-hover/menu-button:text-button-hover-foreground"
                  )} />
                  <span className={cn(
                    "text-sm transition-colors",
                    activeSection === "liveChat" ? "text-button-hover-foreground" : "group-hover/menu-button:text-button-hover-foreground"
                  )}>Live Chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        

        <SidebarGroup className={cn(isCollapsed && "p-0 py-2")}>
          <SidebarGroupLabel className={cn(
            "text-xs text-button-hover uppercase tracking-wide mb-3 transition-all",
            isCollapsed ? "px-0 text-center" : "px-3"
          )}>{isCollapsed ? "" : "Settings"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeSection === "legalSupport"}
                  onClick={() => onSectionChange("legalSupport")}
                  tooltip="Legal & Support"
                >
                  <HelpCircle className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    activeSection === "legalSupport" ? "text-button-hover-foreground" : "text-foreground/70 group-hover/menu-button:text-button-hover-foreground"
                  )} />
                  <span className={cn(
                    "text-sm transition-colors",
                    activeSection === "legalSupport" ? "text-button-hover-foreground" : "group-hover/menu-button:text-button-hover-foreground"
                  )}>Legal & Support</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeSection === "apiData"}
                  onClick={() => onSectionChange("apiData")}
                  tooltip="API Data"
                >
                  <Settings className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    activeSection === "apiData" ? "text-button-hover-foreground" : "text-foreground/70 group-hover/menu-button:text-button-hover-foreground"
                  )} />
                  <span className={cn(
                    "text-sm transition-colors",
                    activeSection === "apiData" ? "text-button-hover-foreground" : "group-hover/menu-button:text-button-hover-foreground"
                  )}>API Data</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 border-t shrink-0 bg-sidebar sticky bottom-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleAccountClick}
              isActive={activeSection === "account"}
              className="p-3 h-auto"
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src="" />
                <AvatarFallback className="text-xs bg-button-hover text-button-hover-foreground font-semibold">EG</AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate text-button-hover group-hover/menu-button:text-button-hover-foreground group-data-[active=true]/menu-button:text-button-hover-foreground">Emilia Greene</span>
                <span className="text-xs truncate text-muted-foreground group-hover/menu-button:text-button-hover-foreground/70 group-data-[active=true]/menu-button:text-button-hover-foreground/70">emilia.greene@example.com</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="Logout"
              className="text-foreground hover:text-foreground hover:bg-muted"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span className="text-sm font-bold">Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
