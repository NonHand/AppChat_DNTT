import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Camera, Mail, User, Check } from "lucide-react";
import toast from "react-hot-toast";

const ProfilePage = () => {
  const { authUser, isUpdatingProfile, updateProfile } = useAuthStore();
  const [selectedImg, setSelectedImg] = useState(null);
  
  // State quản lý việc chỉnh sửa tên
  const [fullName, setFullName] = useState(authUser?.fullName || "");
  const [isEditingName, setIsEditingName] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);
      await updateProfile({ profilePic: base64Image });
    };
  };

  const handleUpdateName = async () => {
    if (fullName.trim() === "") return toast.error("Name cannot be empty");
    if (fullName === authUser.fullName) return setIsEditingName(false);

    try {
      await updateProfile({ fullName: fullName.trim() });
      setIsEditingName(false);
    } catch (error) {
      console.error("Error updating name:", error);
    }
  };

  return (
    <div className="h-screen pt-20">
      <div className="max-w-2xl mx-auto p-4 py-8">
        <div className="bg-base-300 rounded-xl p-6 space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-semibold ">Profile</h1>
            <p className="mt-2 text-base-content/60">Your profile information</p>
          </div>

          {/* Avatar upload section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <img
                src={selectedImg || authUser.profilePic || "/avatar.png"}
                alt="Profile"
                className="size-32 rounded-full object-cover border-4 border-primary/20"
              />
              <label
                htmlFor="avatar-upload"
                className={`
                  absolute bottom-0 right-0 
                  bg-base-content hover:scale-105
                  p-2 rounded-full cursor-pointer 
                  transition-all duration-200
                  ${isUpdatingProfile ? "animate-pulse pointer-events-none" : ""}
                `}
              >
                <Camera className="w-5 h-5 text-base-200" />
                <input
                  type="file"
                  id="avatar-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUpdatingProfile}
                />
              </label>
            </div>
            <p className="text-sm text-zinc-400">
              {isUpdatingProfile ? "Uploading..." : "Click the camera icon to update your photo"}
            </p>
          </div>

          {/* Form fields */}
          <div className="space-y-6">
            {/* Cập nhật Full Name Section */}
            <div className="space-y-1.5">
              <div className="text-sm text-zinc-400 flex items-center gap-2">
                <User className="w-4 h-4" />
                Full Name
              </div>
              <div className="flex gap-2">
                {isEditingName ? (
                  <>
                    <input
                      type="text"
                      className="px-4 py-2.5 bg-base-200 rounded-lg border w-full focus:outline-none focus:ring-2 focus:ring-primary"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoFocus
                    />
                    <button
                      onClick={handleUpdateName}
                      disabled={isUpdatingProfile}
                      className="btn btn-primary btn-sm h-auto px-4"
                    >
                      <Check className="size-4" />
                    </button>
                  </>
                ) : (
                  <div 
                    className="px-4 py-2.5 bg-base-200 rounded-lg border w-full flex justify-between items-center cursor-pointer group hover:border-primary/50 transition-colors"
                    onClick={() => setIsEditingName(true)}
                  >
                    <span>{authUser?.fullName}</span>
                    <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-sm text-zinc-400 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </div>
              <p className="px-4 py-2.5 bg-base-200 rounded-lg border opacity-70 cursor-not-allowed">
                {authUser?.email}
              </p>
            </div>
          </div>

          {/* Account info section */}
          <div className="mt-6 bg-base-300 rounded-xl p-6">
            <h2 className="text-lg font-medium mb-4">Account Information</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-zinc-700">
                <span>Member Since</span>
                <span>{authUser.createdAt?.split("T")[0]}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span>Account Status</span>
                <span className="text-green-500 font-medium">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;