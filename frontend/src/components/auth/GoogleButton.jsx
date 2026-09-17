
function GoogleButton() {
  const handleGoogleLogin = () => {
    window.location.href =
      "http://localhost:8000/accounts/google/login/?process=login";
  };

  return (
    <button
      type="button"
      className="google-button"
      onClick={handleGoogleLogin}
    >
      <span className="google-icon">G</span>
      Continue with Google
    </button>
  );
}

export default GoogleButton;
