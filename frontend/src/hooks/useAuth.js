import { useSelector, useDispatch } from "react-redux";
import {
  setCredentials,
  logout as logoutAction,
  updateUser as updateUserAction,
  selectCurrentUser,
  selectCurrentToken,
  selectIsAuthenticated,
  selectUserAvatar,
} from "../features/auth/authSlice";

export function useAuth() {
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const token = useSelector(selectCurrentToken);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const avatar = useSelector(selectUserAvatar);


  const login = (accessToken, refreshToken, userData) => {
    dispatch(
      setCredentials({
        access: accessToken,
        refresh: refreshToken,
        user: userData,
      })
    );
  };

  const logout = () => {
    dispatch(logoutAction());
  };

  const updateUser = (userData) => {
    dispatch(updateUserAction(userData));
  };

  return {
    user,
    token,
    isAuthenticated,
    avatar,
    login,
    logout,
    updateUser,
  };
}

export default useAuth;

