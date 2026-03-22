import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { LogOut, MessageSquare, Settings } from "lucide-react";

const Navbar = () => {
  const { logout, authUser } = useAuthStore();

  return (
    <header
      className="bg-base-100 border-b border-base-300 fixed w-full top-0 z-40 
    backdrop-blur-lg bg-base-100/80"
    >
      <div className="container mx-auto px-4 h-16">
        <div className="flex items-center justify-between h-full">
          {/* Logo Chatty */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-all">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-lg font-bold">Chatty</h1>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Nút Settings */}
            <Link
              to={"/settings"}
              className="btn btn-sm gap-2 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>

            {authUser && (
              <>
                {/* PHẦN THAY ĐỔI: Chuyển nút Profile thành Avatar tròn + Tên */}
                <Link 
                  to={"/profile"} 
                  className="flex items-center gap-2 p-1 pr-3 rounded-full hover:bg-base-200 transition-all border border-base-300 ml-2"
                >
                  <div className="size-8 rounded-full overflow-hidden border-2 border-primary">
                    <img
                      src={authUser.profilePic || "/avatar.png"}
                      alt="profile"
                      className="object-cover size-full"
                    />
                  </div>
                  <span className="text-sm font-semibold hidden md:block">
                    {authUser.fullName}
                  </span>
                </Link>

                {/* Nút Logout */}
                <button 
                  className="btn btn-sm btn-ghost gap-2 items-center text-error" 
                  onClick={logout}
                >
                  <LogOut className="size-5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;